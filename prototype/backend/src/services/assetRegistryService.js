const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '../../../..');
const REGISTRY_PATH = path.join(ROOT_DIR, 'assets-library', 'manifests', 'asset-registry.json');

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

function getAllAssets() {
  return readRegistry().assets;
}

function getAssetById(id) {
  return getAllAssets().find((asset) => asset.id === id) || null;
}

function normalize(value) {
  return String(value || '').toLowerCase().trim();
}

function assetSearchText(asset) {
  return [
    asset.id,
    asset.name,
    asset.type,
    asset.category,
    asset.subcategory,
    ...(asset.tags || []),
    ...(asset.engineCompatibility || [])
  ].map(normalize).join(' ');
}

function searchAssets(query) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return getAllAssets();
  return getAllAssets().filter((asset) => {
    const haystack = assetSearchText(asset);
    return terms.every((term) => haystack.includes(term));
  });
}

function getAssetsByType(type) {
  const target = normalize(type);
  return getAllAssets().filter((asset) => normalize(asset.type) === target);
}

function getAssetsByCategory(category) {
  const target = normalize(category);
  return getAllAssets().filter((asset) => normalize(asset.category) === target);
}

function getAssetsByTags(tags) {
  const required = new Set((Array.isArray(tags) ? tags : [tags]).map(normalize).filter(Boolean));
  if (required.size === 0) return getAllAssets();
  return getAllAssets().filter((asset) => {
    const assetTags = new Set((asset.tags || []).map(normalize));
    return [...required].every((tag) => assetTags.has(tag));
  });
}

function getAssetsForEngine(engine) {
  const target = normalize(engine);
  return getAllAssets().filter((asset) => (asset.engineCompatibility || []).map(normalize).includes(target));
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
  if (preferredEngine && (asset.engineCompatibility || []).map(normalize).includes(preferredEngine)) score += 3;
  for (const field of [asset.name, asset.type, asset.category, asset.subcategory]) {
    const value = normalize(field);
    if (value && text.includes(value)) score += 2;
  }
  for (const tag of asset.tags || []) {
    const value = normalize(tag);
    if (value && text.includes(value)) score += 1;
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
      .filter((asset) => !targetEngine || (asset.engineCompatibility || []).map(normalize).includes(targetEngine))
      .map((asset) => ({
        key: asset.id,
        type: asset.type,
        url: asset.publicPath
      }))
  };
}

module.exports = {
  buildGameAssetManifest,
  getAllAssets,
  getAssetById,
  getAssetsByCategory,
  getAssetsByTags,
  getAssetsByType,
  getAssetsForEngine,
  getRecommendedAssetsForGameBrief,
  searchAssets
};
