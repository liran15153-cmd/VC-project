const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '../../../..');
const REGISTRY_PATH = path.join(ROOT_DIR, 'assets-library', 'manifests', 'asset-registry.json');

let cachedIndex = null;

const THEME_TERMS = [
  'platformer',
  'desert',
  'shooter',
  'roguelike',
  'rpg',
  'dungeon',
  'mobile',
  'controls',
  'forest',
  'garden',
  'sci-fi',
  'fantasy',
  'low-poly'
];

const STYLE_TERMS = [
  'pixel',
  'low-poly',
  'cartoon',
  'clean',
  'bright',
  'dark',
  'magenta',
  'transparent',
  'packed'
];

function readRegistry() {
  if (!fs.existsSync(REGISTRY_PATH)) return { schemaVersion: 1, generatedAt: null, assets: [] };
  const parsed = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  if (Array.isArray(parsed)) return { schemaVersion: 1, generatedAt: null, assets: parsed };
  return {
    schemaVersion: parsed.schemaVersion || 1,
    generatedAt: parsed.generatedAt || null,
    assets: Array.isArray(parsed.assets) ? parsed.assets : []
  };
}

function getRegistryIndex() {
  if (!cachedIndex) cachedIndex = createAssetRegistryIndex(readRegistry());
  return cachedIndex;
}

function refreshAssetRegistryCache() {
  cachedIndex = createAssetRegistryIndex(readRegistry());
  return cachedIndex;
}

function createAssetRegistryIndex(registry) {
  const rawAssets = Array.isArray(registry?.assets) ? registry.assets : [];
  const indexes = {
    byId: new Map(),
    byPack: new Map(),
    byType: new Map(),
    byCategory: new Map(),
    byRole: new Map(),
    byTag: new Map(),
    byEngine: new Map(),
    byDimension: new Map(),
    byTheme: new Map(),
    byStyle: new Map()
  };
  const packBuilders = new Map();
  const assets = rawAssets.map(enrichAsset);

  for (const asset of assets) {
    indexes.byId.set(asset.id, asset);
    addToIndex(indexes.byPack, asset.packId, asset.id);
    addToIndex(indexes.byType, normalize(asset.type), asset.id);
    addToIndex(indexes.byCategory, normalize(asset.category), asset.id);
    addToIndex(indexes.byDimension, asset.assetDimension, asset.id);
    for (const role of asset.normalizedRoleHints) addToIndex(indexes.byRole, role, asset.id);
    for (const tag of asset.normalizedTags) addToIndex(indexes.byTag, tag, asset.id);
    for (const engine of asset.normalizedEngines) addToIndex(indexes.byEngine, engine, asset.id);
    for (const theme of asset.assetThemes) addToIndex(indexes.byTheme, theme, asset.id);
    for (const style of asset.assetStyles) addToIndex(indexes.byStyle, style, asset.id);
    addToPackBuilder(packBuilders, asset);
  }

  const packSummaries = [...packBuilders.values()]
    .map(finalizePackSummary)
    .sort((a, b) => a.packId.localeCompare(b.packId));
  const packSummaryById = new Map(packSummaries.map((summary) => [summary.packId, summary]));

  return {
    schemaVersion: registry?.schemaVersion || 1,
    generatedAt: registry?.generatedAt || null,
    totalAssets: assets.length,
    assets,
    indexes,
    packSummaries,
    packSummaryById,
    loadedAt: new Date().toISOString()
  };
}

function enrichAsset(asset) {
  const packId = resolveAssetPackId(asset);
  const normalizedEngines = (asset.engineCompatibility || []).map(normalize).filter(Boolean);
  const normalizedTags = (asset.tags || []).map(normalize).filter(Boolean);
  const normalizedRoleHints = (asset.roleHints || []).map(normalize).filter(Boolean);
  const searchText = assetSearchText(asset, packId);
  const assetDimension = inferAssetDimension(asset, normalizedEngines);
  const assetThemes = extractTerms(searchText, THEME_TERMS);
  const assetStyles = extractTerms(searchText, STYLE_TERMS);

  return {
    ...asset,
    packId,
    searchText,
    normalizedType: normalize(asset.type),
    normalizedCategory: normalize(asset.category),
    normalizedSubcategory: normalize(asset.subcategory),
    normalizedTags,
    normalizedRoleHints,
    normalizedEngines,
    assetDimension,
    assetThemes,
    assetStyles
  };
}

function resolveAssetPackId(asset) {
  const direct = normalize(asset.pack || asset.sourcePack);
  if (direct) return direct;

  for (const value of [asset.publicPath, asset.filePath, asset.sourceRelativePath, asset.id]) {
    const normalized = String(value || '').replace(/\\/g, '/');
    const publicMatch = normalized.match(/\/assets\/library\/([^/]+)/);
    if (publicMatch) return normalize(publicMatch[1]);
    const processedMatch = normalized.match(/assets-library\/processed\/([^/]+)/);
    if (processedMatch) return normalize(processedMatch[1]);
  }

  const id = String(asset.id || '').split('-').slice(0, 3).join('-');
  return normalize(id || 'unknown-pack');
}

function inferAssetDimension(asset, engines) {
  const type = normalize(asset.type);
  if (type === 'gltf') return '3D';
  if (type === 'audio' || type === 'text' || type === 'json') return 'any';
  if (engines.includes('phaser') && !engines.includes('three')) return '2D';
  if (engines.includes('three') && !engines.includes('phaser')) return '3D';
  if (engines.includes('phaser') && engines.includes('three')) return 'hybrid';
  return 'any';
}

function addToPackBuilder(packBuilders, asset) {
  if (!packBuilders.has(asset.packId)) {
    packBuilders.set(asset.packId, {
      packId: asset.packId,
      assetCount: 0,
      engines: new Set(),
      roles: new Set(),
      themes: new Set(),
      styles: new Set(),
      types: new Set(),
      categories: new Set(),
      dimensions: new Set(),
      licenses: new Set(),
      sampleText: []
    });
  }

  const builder = packBuilders.get(asset.packId);
  builder.assetCount += 1;
  for (const engine of asset.normalizedEngines) builder.engines.add(engine);
  for (const role of asset.normalizedRoleHints) builder.roles.add(role);
  for (const theme of asset.assetThemes) builder.themes.add(theme);
  for (const style of asset.assetStyles) builder.styles.add(style);
  if (asset.normalizedType) builder.types.add(asset.normalizedType);
  if (asset.normalizedCategory) builder.categories.add(asset.normalizedCategory);
  if (asset.assetDimension) builder.dimensions.add(asset.assetDimension);
  if (asset.license) builder.licenses.add(String(asset.license));
  if (builder.sampleText.length < 30) builder.sampleText.push(asset.searchText);
}

function finalizePackSummary(builder) {
  const dimensions = [...builder.dimensions].filter(Boolean).sort();
  const engines = [...builder.engines].filter(Boolean).sort();
  const roles = [...builder.roles].filter(Boolean).sort();
  const themes = [...builder.themes].filter(Boolean).sort();
  const styles = [...builder.styles].filter(Boolean).sort();
  const types = [...builder.types].filter(Boolean).sort();
  const categories = [...builder.categories].filter(Boolean).sort();
  const licenses = [...builder.licenses].filter(Boolean).sort();
  const dimension = dimensions.includes('2D') && dimensions.includes('3D')
    ? 'hybrid'
    : dimensions.find((value) => value !== 'any') || 'any';
  const summaryText = normalize([
    builder.packId,
    ...engines,
    ...roles,
    ...themes,
    ...styles,
    ...types,
    ...categories,
    ...builder.sampleText
  ].join(' '));

  return {
    packId: builder.packId,
    assetCount: builder.assetCount,
    dimension,
    dimensions,
    engines,
    roles,
    themes,
    styles,
    types,
    categories,
    license: licenses[0] || 'unknown',
    summaryText
  };
}

function addToIndex(index, key, id) {
  const normalizedKey = normalize(key);
  if (!normalizedKey) return;
  if (!index.has(normalizedKey)) index.set(normalizedKey, new Set());
  index.get(normalizedKey).add(id);
}

function extractTerms(text, terms) {
  return [...new Set(terms.map(normalize).filter((term) => text.includes(term)))];
}

function getAllAssets() {
  return getRegistryIndex().assets;
}

function getAssetById(id) {
  return getRegistryIndex().indexes.byId.get(id) || null;
}

function getAssetsByIds(ids) {
  return (Array.isArray(ids) ? ids : []).map(getAssetById).filter(Boolean);
}

function getPackSummaries() {
  return getRegistryIndex().packSummaries;
}

function assetSearchText(asset, packId = resolveAssetPackId(asset)) {
  return [
    asset.id,
    asset.name,
    asset.type,
    asset.format,
    asset.category,
    asset.subcategory,
    packId,
    asset.pack,
    asset.sourcePack,
    asset.sourceRelativePath,
    asset.variant,
    asset.scale,
    asset.atlasImage,
    ...(asset.roleHints || []),
    ...(asset.tags || []),
    ...(asset.engineCompatibility || [])
  ].map(normalize).filter(Boolean).join(' ');
}

function searchAssets(query) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return getAllAssets();
  return getAllAssets().filter((asset) => terms.every((term) => asset.searchText.includes(term)));
}

function getAssetsByType(type) {
  const ids = getRegistryIndex().indexes.byType.get(normalize(type)) || new Set();
  return idsToAssets(ids);
}

function getAssetsByCategory(category) {
  const ids = getRegistryIndex().indexes.byCategory.get(normalize(category)) || new Set();
  return idsToAssets(ids);
}

function getAssetsByTags(tags) {
  const required = (Array.isArray(tags) ? tags : [tags]).map(normalize).filter(Boolean);
  if (required.length === 0) return getAllAssets();
  const index = getRegistryIndex().indexes.byTag;
  const sets = required.map((tag) => index.get(tag) || new Set());
  return idsToAssets(intersectSets(sets));
}

function getAssetsForEngine(engine) {
  const ids = getRegistryIndex().indexes.byEngine.get(normalize(engine)) || new Set();
  return idsToAssets(ids);
}

function getRecommendedAssetsForGameBrief(gameBrief = {}, limit = 12) {
  const text = normalize([
    gameBrief.prompt,
    gameBrief.gameType,
    gameBrief.dimension,
    gameBrief.genre,
    gameBrief.visualStyle,
    gameBrief.theme,
    gameBrief?.runtimePlan?.dimension,
    gameBrief?.runtimePlan?.genre,
    ...(gameBrief?.assetPlan?.existingAssetsToUse || []),
    ...(gameBrief?.assetPlan?.assetsToGenerate || []),
    ...(gameBrief.tags || [])
  ].flat().filter(Boolean).join(' '));

  const preferredEngine = text.includes('3d') ? 'three' : text.includes('phaser') || text.includes('2d') ? 'phaser' : null;
  const assets = preferredEngine ? getAssetsForEngine(preferredEngine) : getAllAssets();

  return assets
    .map((asset) => ({ asset, score: scoreAsset(asset, text, preferredEngine) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.asset.id.localeCompare(b.asset.id))
    .slice(0, limit)
    .map((entry) => entry.asset);
}

function scoreAsset(asset, text, preferredEngine) {
  let score = 0;
  if (preferredEngine && asset.normalizedEngines.includes(preferredEngine)) score += 3;
  for (const field of [asset.name, asset.type, asset.category, asset.subcategory, asset.packId]) {
    const value = normalize(field);
    if (value && text.includes(value)) score += 2;
  }
  for (const tag of asset.normalizedTags || []) {
    if (tag && text.includes(tag)) score += 1;
  }
  if (score === 0 && preferredEngine) score = 1;
  return score;
}

function buildGameAssetManifest(assetIds, engine) {
  const targetEngine = normalize(engine);
  const ids = Array.isArray(assetIds) ? assetIds : [];

  return {
    engine: targetEngine || 'any',
    assets: ids
      .map(getAssetById)
      .filter(Boolean)
      .filter((asset) => !targetEngine || asset.normalizedEngines.includes(targetEngine))
      .map((asset) => ({
        key: asset.id,
        type: asset.type,
        url: asset.publicPath
      }))
  };
}

function idsToAssets(ids) {
  const byId = getRegistryIndex().indexes.byId;
  return [...ids].map((id) => byId.get(id)).filter(Boolean);
}

function intersectSets(sets) {
  const sorted = sets.filter(Boolean).sort((a, b) => a.size - b.size);
  if (sorted.length === 0) return new Set();
  const [smallest, ...rest] = sorted;
  const result = new Set();
  for (const id of smallest) {
    if (rest.every((set) => set.has(id))) result.add(id);
  }
  return result;
}

function normalize(value) {
  return String(value || '').toLowerCase().trim();
}

module.exports = {
  buildGameAssetManifest,
  createAssetRegistryIndex,
  getAllAssets,
  getAssetById,
  getAssetsByCategory,
  getAssetsByIds,
  getAssetsByTags,
  getAssetsByType,
  getAssetsForEngine,
  getPackSummaries,
  getRecommendedAssetsForGameBrief,
  getRegistryIndex,
  readRegistry,
  refreshAssetRegistryCache,
  resolveAssetPackId,
  searchAssets
};
