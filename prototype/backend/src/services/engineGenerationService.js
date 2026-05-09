const { GENERATION } = require('../config/constants');
const { generateJSON } = require('./openaiService');
const {
  ENGINE_GAME_SYSTEM_PROMPT,
  buildEngineGenerationPrompt,
  buildEngineCorrectionPrompt
} = require('./enginePromptService');
const { validateEngineGameDefinitionSafe } = require('../schemas/engineGameDefinitionSchema');
const {
  buildGameAssetManifest,
  getAssetById,
  getRecommendedAssetsForGameBrief
} = require('./assetRegistryService');
const { ExternalAPIError } = require('../utils/errors');
const logger = require('../utils/logger');

const MAX_ASSET_CANDIDATES = 12;

async function generateEngineGameWithRetries({ prompt, model, brief = null, assetCandidates = [], assetManifest = null }) {
  let lastReason = null;
  let userPrompt = buildEngineGenerationPrompt({ prompt, brief, assetCandidates, assetManifest });
  let totalDurationMs = 0;
  let lastModel = model || null;

  for (let attempt = 1; attempt <= GENERATION.MAX_RETRIES; attempt++) {
    const result = await generateJSON({
      prompt: userPrompt,
      systemPrompt: ENGINE_GAME_SYSTEM_PROMPT,
      model,
      generationConfig: { temperature: attempt === 1 ? 0.92 : 0.7, maxOutputTokens: 12000 }
    });

    totalDurationMs += result.durationMs;
    lastModel = result.model;

    const check = validateEngineGameDefinitionSafe(result.json);
    if (check.ok) {
      const assetUseCheck = validateGeneratedAssetUse(check.data, assetCandidates);
      if (assetUseCheck.ok) {
        return {
          gameDefinition: check.data,
          model: result.model,
          durationMs: totalDurationMs,
          attempts: attempt
        };
      }
      lastReason = assetUseCheck.reason;
    } else {
      lastReason = check.errors.map((error) => `${error.path || '<root>'}: ${error.message}`).join('; ');
    }

    logger.warn({ attempt, reason: lastReason }, 'GAME_ENGINE GameDefinition validation failed');
    userPrompt = buildEngineCorrectionPrompt({
      originalPrompt: prompt,
      validationReason: lastReason,
      brief,
      assetCandidates,
      assetManifest
    });
  }

  throw new ExternalAPIError(
    lastModel || 'AI provider',
    `GameDefinition validation failed after ${GENERATION.MAX_RETRIES} attempts: ${lastReason || 'unknown validation error'}`
  );
}

async function generateEngineGameFromBrief({ prompt, answers, gameType, dimension, brief, model, selectedAssetIds = [] }) {
  const assetCandidates = selectAssetCandidatesForBrief({ prompt, answers, gameType, dimension, brief, selectedAssetIds });
  const targetEngine = targetEngineForBrief(brief, dimension);
  const assetManifest = buildGameAssetManifest(assetCandidates.map((asset) => asset.id), targetEngine);
  const promptText = promptFromBrief(prompt, brief);

  const result = await generateEngineGameWithRetries({
    prompt: promptText,
    model,
    brief,
    assetCandidates,
    assetManifest
  });

  return {
    brief,
    selectedAssets: assetCandidates.map(publicAssetSummary),
    assetManifest,
    gameDefinition: result.gameDefinition,
    model: result.model,
    durationMs: result.durationMs,
    attempts: result.attempts
  };
}

function selectAssetCandidatesForBrief({ prompt, answers, gameType, dimension, brief, selectedAssetIds = [] }) {
  const selectedAssets = selectedAssetIds
    .map(getAssetById)
    .filter(Boolean);

  const sourceAssets = selectedAssets.length > 0
    ? selectedAssets
    : getRecommendedAssetsForGameBrief({
      ...brief,
      prompt,
      answers,
      gameType,
      dimension,
      genre: brief.genre,
      visualStyle: brief.assetPlan?.visualStyle,
      tags: [
        brief.genre,
        brief.dimension,
        ...(brief.assetPlan?.existingAssetsToUse || []),
        ...(brief.assetPlan?.assetsToGenerate || []),
        ...(brief.keyMechanics || [])
      ]
    }, 60);

  return dedupeAssets(sourceAssets)
    .filter(isRuntimePreviewAsset)
    .sort((a, b) => rankAssetForBrief(b, brief, dimension) - rankAssetForBrief(a, brief, dimension) || a.id.localeCompare(b.id))
    .slice(0, MAX_ASSET_CANDIDATES);
}

function isRuntimePreviewAsset(asset) {
  if (!asset?.id || !asset.publicPath) return false;
  const type = normalize(asset.type);
  const format = normalize(asset.format);
  if (type === 'gltf') return format === 'glb' || format === 'gltf';
  return type === 'image' || type === 'spritesheet';
}

function rankAssetForBrief(asset, brief, dimension) {
  const is3D = normalize(dimension || brief.dimension).includes('3d') || normalize(brief.dimension) === 'hybrid';
  const type = normalize(asset.type);
  const format = normalize(asset.format);
  let score = 0;

  if (is3D && type === 'gltf' && format === 'glb') score += 50;
  if (!is3D && (type === 'image' || type === 'spritesheet')) score += 50;
  if (type === 'gltf' && format === 'gltf') score += 35;
  if (type === 'image' || type === 'spritesheet') score += 20;

  const briefText = normalize([
    brief.title,
    brief.oneSentencePitch,
    brief.playerFantasy,
    brief.genre,
    brief.assetPlan?.visualStyle,
    ...(brief.assetPlan?.existingAssetsToUse || []),
    ...(brief.assetPlan?.assetsToGenerate || []),
    ...(brief.keyMechanics || [])
  ].join(' '));

  for (const tag of asset.tags || []) {
    if (briefText.includes(normalize(tag))) score += 2;
  }
  if (briefText.includes(normalize(asset.name))) score += 4;
  return score;
}

function validateGeneratedAssetUse(gameDefinition, assetCandidates) {
  if (!assetCandidates.length || !Array.isArray(gameDefinition.assets)) return { ok: true };

  const allowed = new Map(assetCandidates.map((asset) => [asset.id, asset]));
  for (const asset of gameDefinition.assets) {
    const source = allowed.get(asset.key);
    if (!source) {
      return { ok: false, reason: `Generated asset "${asset.key}" is not in the supplied asset candidates.` };
    }
    const expectedType = runtimeAssetType(source);
    if (asset.type !== expectedType) {
      return { ok: false, reason: `Generated asset "${asset.key}" has type "${asset.type}" but must be "${expectedType}".` };
    }
    if (asset.url !== source.publicPath) {
      return { ok: false, reason: `Generated asset "${asset.key}" must use exact publicPath "${source.publicPath}".` };
    }
  }

  return { ok: true };
}

function runtimeAssetType(asset) {
  if (normalize(asset.type) === 'gltf') return 'gltf';
  if (normalize(asset.type) === 'spritesheet') return 'spritesheet';
  return 'image';
}

function targetEngineForBrief(brief, dimension) {
  const text = normalize([dimension, brief.dimension, brief.runtimePlan?.threeRole, brief.runtimePlan?.phaserRole].join(' '));
  if (text.includes('2d') && !text.includes('3d')) return 'phaser';
  return 'three';
}

function promptFromBrief(prompt, brief) {
  return prompt || [
    brief.title,
    brief.oneSentencePitch,
    brief.playerFantasy,
    brief.coreLoop?.join(' -> '),
    brief.keyMechanics?.join(', ')
  ].filter(Boolean).join('\n');
}

function dedupeAssets(assets) {
  const seen = new Set();
  return assets.filter((asset) => {
    if (!asset?.id || seen.has(asset.id)) return false;
    seen.add(asset.id);
    return true;
  });
}

function publicAssetSummary(asset) {
  return {
    id: asset.id,
    name: asset.name,
    type: asset.type,
    format: asset.format,
    category: asset.category,
    subcategory: asset.subcategory,
    tags: asset.tags || [],
    engineCompatibility: asset.engineCompatibility || [],
    publicPath: asset.publicPath,
    source: asset.source,
    license: asset.license,
    fileSize: asset.fileSize
  };
}

function normalize(value) {
  return String(value || '').toLowerCase().trim();
}

module.exports = {
  generateEngineGameFromBrief,
  generateEngineGameWithRetries,
  selectAssetCandidatesForBrief,
  validateGeneratedAssetUse
};
