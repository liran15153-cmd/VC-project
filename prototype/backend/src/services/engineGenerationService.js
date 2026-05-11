const { GENERATION } = require('../config/constants');
const config = require('../config/env');
const { generateJSON } = require('./openaiService');
const { generateJSONWithSingleTool } = require('./jsonAgentService');
const {
  ENGINE_GAME_SYSTEM_PROMPT,
  buildEngineGenerationPrompt,
  buildEngineCorrectionPrompt
} = require('./enginePromptService');
const {
  getEngineToolBudget,
  buildCompactToolPrompt,
  compactAssetResolutionForModel
} = require('./engineToolBudgetService');
const { validateEngineGameDefinitionSafe } = require('../schemas/engineGameDefinitionSchema');
const {
  resolveAssetsForBrief
} = require('./assetResolutionService');
const { ExternalAPIError } = require('../utils/errors');
const logger = require('../utils/logger');

async function generateEngineGameWithRetries({ prompt, model, brief = null, assetCandidates = [], assetManifest = null, maxOutputTokens = 12000 }) {
  let lastReason = null;
  let userPrompt = buildEngineGenerationPrompt({ prompt, brief, assetCandidates, assetManifest });
  let totalDurationMs = 0;
  let lastModel = model || null;
  let lastRaw = null;

  for (let attempt = 1; attempt <= GENERATION.MAX_RETRIES; attempt++) {
    const result = await generateJSON({
      prompt: userPrompt,
      systemPrompt: ENGINE_GAME_SYSTEM_PROMPT,
      model,
      generationConfig: { temperature: attempt === 1 ? 0.92 : 0.7, maxOutputTokens }
    });

    totalDurationMs += result.durationMs;
    lastModel = result.model;
    lastRaw = result.raw;

    const check = validateEngineGameDefinitionSafe(result.json);
    if (check.ok) {
      const assetUseCheck = validateGeneratedAssetUse(check.data, assetCandidates);
      if (assetUseCheck.ok) {
        return {
          gameDefinition: check.data,
          model: result.model,
          durationMs: totalDurationMs,
          attempts: attempt,
          raw: lastRaw
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

async function generateEngineGameFromBrief({ prompt, answers, gameType, dimension, brief, model, selectedAssetIds = [], debug = false }) {
  return generateEngineGameFromBriefInternal({ prompt, answers, gameType, dimension, brief, model, selectedAssetIds, debug });
}

async function generateEngineGameFromBriefInternal(input, options = {}) {
  const {
    prompt,
    answers,
    gameType,
    dimension,
    brief,
    model,
    selectedAssetIds = [],
    debug = false
  } = input;
  const budget = getEngineToolBudget({ prompt, answers, gameType, dimension, brief, selectedAssetIds });
  const promptText = promptFromBrief(prompt, brief);
  const toolDebug = buildInitialToolDebug({ enabled: config.ai.toolCallingEnabled && config.ai.realEnabled, budget });

  if (config.ai.toolCallingEnabled && config.ai.realEnabled) {
    const toolResult = await tryGenerateWithAssetTool({
      prompt,
      answers,
      gameType,
      dimension,
      brief,
      model,
      selectedAssetIds,
      promptText,
      budget,
      debug,
      chatCompletionCreate: options.chatCompletionCreate
    });

    if (toolResult.ok) {
      logToolSummary(toolResult.toolCalling, toolResult);
      return {
        brief,
        selectedAssets: toolResult.assetResolution.selectedAssets,
        assetResolution: toolResult.assetResolution,
        assetManifest: toolResult.assetManifest,
        gameDefinition: toolResult.gameDefinition,
        model: toolResult.model,
        durationMs: toolResult.durationMs,
        attempts: toolResult.attempts,
        toolCalling: debug ? toolResult.toolCalling : toolSummary(toolResult.toolCalling)
      };
    }

    Object.assign(toolDebug, toolResult.toolCalling);
  } else {
    toolDebug.attempted = false;
    toolDebug.fallbackUsed = true;
    toolDebug.reason = config.ai.toolCallingEnabled ? 'real AI provider unavailable' : 'feature flag disabled';
  }

  const fallback = await generateFromBriefWithDeterministicAssets({
    prompt,
    answers,
    gameType,
    dimension,
    brief,
    model,
    selectedAssetIds,
    promptText,
    budget
  });
  toolDebug.fallbackUsed = true;
  logToolSummary(toolDebug, fallback);

  return {
    ...fallback,
    toolCalling: debug ? toolDebug : toolSummary(toolDebug)
  };
}

async function generateFromBriefWithDeterministicAssets({
  prompt,
  answers,
  gameType,
  dimension,
  brief,
  model,
  selectedAssetIds,
  promptText,
  budget
}) {
  const assetResolution = resolveAssetsForBrief({ prompt, answers, gameType, dimension, brief, selectedAssetIds });
  const assetCandidates = assetResolution.selectedAssets.map(assetCandidateForGeneration);
  const assetManifest = assetResolution.runtimeAssetManifest;

  const result = await generateEngineGameWithRetries({
    prompt: promptText,
    model,
    brief,
    assetCandidates,
    assetManifest,
    maxOutputTokens: budget.maxOutputTokens
  });

  return {
    brief,
    selectedAssets: assetResolution.selectedAssets,
    assetResolution,
    assetManifest,
    gameDefinition: result.gameDefinition,
    model: result.model,
    durationMs: result.durationMs,
    attempts: result.attempts,
    raw: result.raw
  };
}

async function tryGenerateWithAssetTool({
  prompt,
  answers,
  gameType,
  dimension,
  brief,
  model,
  selectedAssetIds,
  promptText,
  budget,
  debug,
  chatCompletionCreate
}) {
  let resolvedAssetResolution = null;
  let compactToolResult = null;
  const toolPrompt = buildCompactToolPrompt({ prompt, answers, gameType, dimension, brief }, budget);
  const toolCalling = buildInitialToolDebug({ enabled: true, budget });
  toolCalling.attempted = true;

  const result = await generateJSONWithSingleTool({
    prompt: toolPrompt.text,
    systemPrompt: ENGINE_GAME_SYSTEM_PROMPT,
    model,
    generationConfig: { temperature: 0.88, maxOutputTokens: budget.maxOutputTokens },
    tools: [resolveAssetsForBriefToolSchema()],
    toolTimeoutMs: Math.min(config.ai.generationTimeoutMs, 15000),
    maxPromptChars: budget.promptMaxChars,
    chatCompletionCreate,
    toolHandlers: {
      resolveAssetsForBrief: (args) => {
        const sanitizedArgs = sanitizeResolveAssetsToolArgs(args, selectedAssetIds);
        const assetResolution = resolveAssetsForBrief({
          prompt,
          answers,
          gameType,
          dimension,
          brief,
          selectedAssetIds: sanitizedArgs.selectedAssetIds,
          strictMissing: sanitizedArgs.strictMissing,
          debug: false
        });
        const compact = compactAssetResolutionForModel(assetResolution, budget);
        resolvedAssetResolution = assetResolution;
        compactToolResult = compact;
        return {
          content: compact.serialized,
          tooLarge: compact.tooLarge,
          assetResolution,
          compactResult: compact.compact,
          sizeChars: compact.sizeChars,
          compacted: compact.compacted
        };
      }
    }
  });

  Object.assign(toolCalling, {
    ...result.debug,
    used: result.toolUsed,
    fallbackUsed: !result.toolUsed,
    reason: result.fallbackReason || null,
    promptCompressed: toolPrompt.compressed,
    promptChars: toolPrompt.sentChars,
    toolResultChars: compactToolResult?.sizeChars || result.debug?.toolResultChars || 0
  });

  if (!result.toolUsed || !resolvedAssetResolution || !compactToolResult || compactToolResult.tooLarge) {
    return { ok: false, toolCalling };
  }

  const assetCandidates = resolvedAssetResolution.selectedAssets.map(assetCandidateForGeneration);
  const assetManifest = resolvedAssetResolution.runtimeAssetManifest;
  const validated = await validateInitialOrRetry({
    initial: result,
    prompt: promptText,
    model,
    brief,
    assetCandidates,
    assetManifest,
    maxOutputTokens: budget.maxOutputTokens
  });

  Object.assign(toolCalling, {
    selectedAssets: summarizeSelectedAssets(resolvedAssetResolution.selectedAssets),
    missingAssets: summarizeMissingAssets(resolvedAssetResolution.missingAssets),
    finalModelOutput: debug ? validated.raw : undefined
  });

  return {
    ok: true,
    brief,
    assetResolution: resolvedAssetResolution,
    assetManifest,
    gameDefinition: validated.gameDefinition,
    model: validated.model,
    durationMs: validated.durationMs,
    attempts: validated.attempts,
    toolCalling
  };
}

async function validateInitialOrRetry({ initial, prompt, model, brief, assetCandidates, assetManifest, maxOutputTokens }) {
  let totalDurationMs = initial.durationMs;
  let lastModel = initial.model || model || null;
  let lastRaw = initial.raw;
  let lastReason = null;

  const firstCheck = validateGeneratedGameDefinition(initial.json, assetCandidates);
  if (firstCheck.ok) {
    return {
      gameDefinition: firstCheck.data,
      model: initial.model,
      durationMs: totalDurationMs,
      attempts: 1,
      raw: lastRaw
    };
  }
  lastReason = firstCheck.reason;

  for (let attempt = 2; attempt <= GENERATION.MAX_RETRIES; attempt++) {
    logger.warn({ attempt: attempt - 1, reason: lastReason }, 'GAME_ENGINE GameDefinition validation failed after tool call');
    const result = await generateJSON({
      prompt: buildEngineCorrectionPrompt({
        originalPrompt: prompt,
        validationReason: lastReason,
        brief,
        assetCandidates,
        assetManifest
      }),
      systemPrompt: ENGINE_GAME_SYSTEM_PROMPT,
      model,
      generationConfig: { temperature: 0.7, maxOutputTokens }
    });
    totalDurationMs += result.durationMs;
    lastModel = result.model;
    lastRaw = result.raw;

    const check = validateGeneratedGameDefinition(result.json, assetCandidates);
    if (check.ok) {
      return {
        gameDefinition: check.data,
        model: result.model,
        durationMs: totalDurationMs,
        attempts: attempt,
        raw: lastRaw
      };
    }
    lastReason = check.reason;
  }

  throw new ExternalAPIError(
    lastModel || 'AI provider',
    `GameDefinition validation failed after ${GENERATION.MAX_RETRIES} attempts: ${lastReason || 'unknown validation error'}`
  );
}

function validateGeneratedGameDefinition(json, assetCandidates) {
  const check = validateEngineGameDefinitionSafe(json);
  if (!check.ok) {
    return { ok: false, reason: check.errors.map((error) => `${error.path || '<root>'}: ${error.message}`).join('; ') };
  }
  const assetUseCheck = validateGeneratedAssetUse(check.data, assetCandidates);
  if (!assetUseCheck.ok) return { ok: false, reason: assetUseCheck.reason };
  return { ok: true, data: check.data };
}

function resolveAssetsForBriefToolSchema() {
  return {
    type: 'function',
    function: {
      name: 'resolveAssetsForBrief',
      description: 'Resolve existing local game assets for the accepted server-side Game Brief. Use once before final GameDefinition JSON when assets would improve the game.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          selectedAssetIds: {
            type: 'array',
            description: 'Optional known asset ids to prefer. The backend still uses the canonical server-side brief.',
            items: { type: 'string', minLength: 1, maxLength: 180 },
            maxItems: 20
          },
          strictMissing: {
            type: 'boolean',
            description: 'When true, report weak matches as missing instead of substituting.'
          },
          debug: {
            type: 'boolean',
            description: 'Request resolver diagnostics. The backend will not expose internal debug fields to the model.'
          }
        }
      }
    }
  };
}

function sanitizeResolveAssetsToolArgs(args, canonicalSelectedAssetIds = []) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    throw new Error('resolveAssetsForBrief arguments must be an object');
  }
  const allowed = new Set(['selectedAssetIds', 'strictMissing', 'debug']);
  const extraKeys = Object.keys(args).filter((key) => !allowed.has(key));
  if (extraKeys.length) {
    throw new Error(`unsupported resolveAssetsForBrief arguments: ${extraKeys.join(', ')}`);
  }

  let selectedAssetIds = canonicalSelectedAssetIds || [];
  if (Array.isArray(args.selectedAssetIds) && args.selectedAssetIds.length > 0) {
    selectedAssetIds = args.selectedAssetIds
      .filter((id) => typeof id === 'string' && id.trim().length > 0)
      .map((id) => id.trim())
      .slice(0, 20);
  }

  return {
    selectedAssetIds,
    strictMissing: typeof args.strictMissing === 'boolean' ? args.strictMissing : undefined
  };
}

function buildInitialToolDebug({ enabled, budget }) {
  return {
    enabled,
    attempted: false,
    used: false,
    fallbackUsed: false,
    reason: null,
    complexity: budget.complexity,
    budget: {
      promptMaxChars: budget.promptMaxChars,
      toolResultMaxChars: budget.toolResultMaxChars,
      maxSelectedAssets: budget.maxSelectedAssets,
      maxOutputTokens: budget.maxOutputTokens
    }
  };
}

function summarizeSelectedAssets(selectedAssets = []) {
  return selectedAssets.map((asset) => ({
    id: asset.id,
    name: asset.name,
    role: asset.role,
    type: asset.type,
    publicPath: asset.publicPath,
    confidenceScore: asset.confidenceScore
  }));
}

function summarizeMissingAssets(missingAssets = []) {
  return missingAssets.map((asset) => ({
    role: asset.role,
    requested: asset.description || asset.requested,
    reason: asset.reason
  }));
}

function toolSummary(toolCalling = {}) {
  return {
    enabled: toolCalling.enabled,
    attempted: toolCalling.attempted,
    used: toolCalling.used,
    fallbackUsed: toolCalling.fallbackUsed,
    reason: toolCalling.reason || toolCalling.fallbackReason || null,
    complexity: toolCalling.complexity,
    selectedAssetCount: toolCalling.selectedAssets?.length,
    missingAssetCount: toolCalling.missingAssets?.length,
    toolResultChars: toolCalling.toolResultChars
  };
}

function logToolSummary(toolCalling, result) {
  logger.info({
    model: result.model,
    complexity: toolCalling.complexity,
    toolAttempted: toolCalling.attempted,
    toolUsed: toolCalling.used,
    selectedAssetCount: result.selectedAssets?.length || result.assetResolution?.selectedAssets?.length || 0,
    missingAssetCount: result.assetResolution?.missingAssets?.length || 0,
    toolResultChars: toolCalling.toolResultChars,
    durationMs: result.durationMs,
    fallbackReason: toolCalling.reason || toolCalling.fallbackReason || null
  }, 'Engine generation tool-calling summary');
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
  if (normalize(asset.type) === 'atlas') return 'atlas';
  if (normalize(asset.type) === 'tilemap') return 'tilemap';
  if (normalize(asset.type) === 'audio') return 'audio';
  return 'image';
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

function assetCandidateForGeneration(asset) {
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
    pack: asset.pack,
    sourcePack: asset.sourcePack,
    sourceRelativePath: asset.sourceRelativePath,
    roleHints: asset.roleHints,
    variant: asset.variant,
    scale: asset.scale,
    atlasImage: asset.atlasImage,
    license: asset.license,
    fileSize: asset.fileSize,
    confidenceScore: asset.confidenceScore,
    reason: asset.reason
  };
}

function normalize(value) {
  return String(value || '').toLowerCase().trim();
}

module.exports = {
  generateEngineGameFromBrief,
  generateEngineGameFromBriefInternal,
  generateEngineGameWithRetries,
  validateGeneratedAssetUse,
  sanitizeResolveAssetsToolArgs,
  resolveAssetsForBriefToolSchema
};
