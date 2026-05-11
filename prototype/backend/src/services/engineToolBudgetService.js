/* ============================================================================
   GAME_ENGINE Tool Budget Service
   ----------------------------------------------------------------------------
   Small token/cost guardrails for one-shot asset tool calling.
   ========================================================================= */

const { compressForLLM, minimizeText } = require('./promptOptimizer');

const BUDGETS = Object.freeze({
  simple: {
    complexity: 'simple',
    promptMaxChars: 3200,
    toolResultMaxChars: 4500,
    maxSelectedAssets: 10,
    maxOutputTokens: 8000
  },
  normal: {
    complexity: 'normal',
    promptMaxChars: 5200,
    toolResultMaxChars: 7000,
    maxSelectedAssets: 15,
    maxOutputTokens: 10000
  },
  complex: {
    complexity: 'complex',
    promptMaxChars: 7200,
    toolResultMaxChars: 9500,
    maxSelectedAssets: 20,
    maxOutputTokens: 12000
  }
});

function getEngineToolBudget(input = {}) {
  const brief = input.brief || {};
  const promptLength = String(input.prompt || '').length;
  const answersLength = JSON.stringify(input.answers || {}).length;
  const briefLength = JSON.stringify(brief).length;
  const mechanicsCount = (brief.keyMechanics || []).length;
  const loopCount = (brief.coreLoop || []).length;
  const assetNeedCount = (brief.assetPlan?.assetsToGenerate || []).length +
    (brief.assetPlan?.existingAssetsToUse || []).length;
  const selectedCount = (input.selectedAssetIds || []).length;
  const requestedDimension = String(input.dimension || brief.dimension || '').toLowerCase();

  let score = 0;
  if (promptLength > 450) score += 1;
  if (promptLength > 900) score += 1;
  if (answersLength > 800) score += 1;
  if (briefLength > 2800) score += 1;
  if (briefLength > 5200) score += 1;
  if (mechanicsCount > 5 || loopCount > 5) score += 1;
  if (assetNeedCount > 7) score += 1;
  if (selectedCount > 0) score += 2;
  if (requestedDimension === '3d' || requestedDimension === 'hybrid') score += 1;

  if (
    score === 0 &&
    promptLength <= 300 &&
    answersLength <= 500 &&
    briefLength <= 2400 &&
    mechanicsCount <= 4 &&
    assetNeedCount <= 4
  ) {
    return BUDGETS.simple;
  }
  if (score >= 3) return BUDGETS.complex;
  return BUDGETS.normal;
}

function buildCompactToolPrompt({ prompt, answers = {}, gameType, dimension, brief }, budget) {
  const compactBrief = compactBriefForToolPrompt(brief);
  const compact = {
    prompt: minimizeText(prompt || compactBrief.goal || compactBrief.title || ''),
    gameType,
    dimension: dimension || brief?.dimension,
    answers: compactAnswers(answers),
    brief: compactBrief
  };

  const body = [
    'Use the resolveAssetsForBrief tool once before final JSON if existing assets can improve this game.',
    'After a tool result is available, generate one GAME_ENGINE GameDefinition JSON object using only returned asset ids and publicPath values.',
    'If no useful asset is returned, generate with supported primitive meshes.',
    '',
    'COMPACT GAME REQUEST JSON:',
    JSON.stringify(compact, null, 2)
  ].join('\n');

  return compressForLLM(body, budget.promptMaxChars);
}

function compactBriefForToolPrompt(brief = {}) {
  return {
    title: brief.title,
    goal: brief.oneSentencePitch,
    playerFantasy: brief.playerFantasy,
    dimension: brief.dimension,
    genre: brief.genre,
    coreLoop: brief.coreLoop || [],
    mechanics: brief.keyMechanics || [],
    controls: brief.controls ? {
      primary: brief.controls.primary,
      mobile: brief.controls.mobile
    } : undefined,
    runtime: brief.runtimePlan ? {
      phaser: brief.runtimePlan.phaserRole,
      three: brief.runtimePlan.threeRole,
      rapier: brief.runtimePlan.rapierRole,
      systems: brief.runtimePlan.systems || []
    } : undefined,
    style: brief.assetPlan?.visualStyle,
    assetsToUse: brief.assetPlan?.existingAssetsToUse || [],
    assetsNeeded: brief.assetPlan?.assetsToGenerate || [],
    winLoseAndProduction: [
      ...(brief.productionNotes || []),
      ...(brief.nonGoals || []).map((item) => `Non-goal: ${item}`)
    ].slice(0, 8)
  };
}

function compactAnswers(answers = {}) {
  const entries = Object.entries(answers).slice(0, 20);
  return Object.fromEntries(entries.map(([key, value]) => [key, minimizeText(value).slice(0, 180)]));
}

function compactAssetResolutionForModel(assetResolution, budget) {
  const maxSelected = Math.max(1, budget.maxSelectedAssets);
  let compact = buildCompactAssetResolution(assetResolution, maxSelected, false);
  let serialized = JSON.stringify(compact);
  let compacted = false;

  if (serialized.length > budget.toolResultMaxChars) {
    compact = buildCompactAssetResolution(assetResolution, Math.max(1, Math.floor(maxSelected / 2)), true);
    serialized = JSON.stringify(compact);
    compacted = true;
  }

  return {
    compact,
    serialized,
    sizeChars: serialized.length,
    compacted,
    tooLarge: serialized.length > budget.toolResultMaxChars
  };
}

function buildCompactAssetResolution(assetResolution, maxSelected, aggressive) {
  const selectedAssets = (assetResolution.selectedAssets || [])
    .slice(0, maxSelected)
    .map((asset) => ({
      id: asset.id,
      role: asset.role,
      name: asset.name,
      type: asset.type,
      publicPath: asset.publicPath,
      confidenceScore: asset.confidenceScore,
      reason: trimReason(asset.reason, aggressive ? 72 : 120)
    }));

  const missingAssets = (assetResolution.missingAssets || [])
    .slice(0, aggressive ? 4 : 8)
    .map((asset) => ({
      role: asset.role,
      requested: asset.description || asset.requested,
      reason: trimReason(asset.reason, aggressive ? 72 : 120)
    }));

  const selectedIds = new Set(selectedAssets.map((asset) => asset.id));
  const manifestAssets = (assetResolution.runtimeAssetManifest?.assets || [])
    .filter((asset) => selectedIds.has(asset.key))
    .map((asset) => ({
      key: asset.key,
      type: asset.type,
      url: asset.url
    }));

  return {
    selectedAssets,
    missingAssets,
    runtimeAssetManifest: {
      engine: assetResolution.runtimeAssetManifest?.engine || assetResolution.meta?.targetEngine || 'any',
      assets: manifestAssets
    }
  };
}

function trimReason(value, maxLength) {
  const text = minimizeText(value || '');
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}.`;
}

module.exports = {
  BUDGETS,
  getEngineToolBudget,
  buildCompactToolPrompt,
  compactBriefForToolPrompt,
  compactAssetResolutionForModel
};
