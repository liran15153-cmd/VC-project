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
const { runDebugDiagnostics, summarizeDiagnostics } = require('../debugProtocol/diagnostics');
const { DIAGNOSTIC_CODES } = require('../debugProtocol/types');
const { repairGameDefinition, REPAIRABLE_CODES, MAX_REPAIR_ITERATIONS } = require('../debugProtocol/repairer');

async function generateEngineGameWithRetries({ prompt, model, brief = null, assetCandidates = [], assetManifest = null, maxOutputTokens = 12000 }) {
  let lastReason = null;
  let userPrompt = buildEngineGenerationPrompt({ prompt, brief, assetCandidates, assetManifest });
  let totalDurationMs = 0;
  let lastModel = model || null;
  let lastRaw = null;
  let bestContractFallback = null;

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

    const check = validateGeneratedGameDefinition(result.json, assetCandidates);
    if (check.ok) {
      const final = tryRepairAndValidate(check, assetCandidates);
      if (shouldRetryGenerationContract(final, attempt)) {
        bestContractFallback = { final, model: result.model, raw: lastRaw };
        lastReason = final.generationContractReason;
        logger.warn({ attempt, reason: lastReason }, 'GAME_ENGINE generation contract needs correction');
        userPrompt = buildEngineCorrectionPrompt({
          originalPrompt: prompt,
          validationReason: lastReason,
          brief,
          assetCandidates,
          assetManifest
        });
        continue;
      }
      logger.info({
        attempt,
        schemaOk: true,
        normalizationWarningCount: (final.warnings || []).length,
        diagnostics: summarizeDiagnostics(final.debugReport).diagnostics,
        repaired: final.debugRepair?.accepted || false
      }, 'GAME_ENGINE GameDefinition validation passed');
      return {
        gameDefinition: final.data,
        model: result.model,
        durationMs: totalDurationMs,
        attempts: attempt,
        normalizationWarnings: final.warnings || [],
        debugDiagnostics: final.debugReport?.diagnostics || [],
        debugRepair: final.debugRepair,
        assetUsageSummary: final.assetUsageSummary,
        behaviorStateUsageSummary: final.behaviorStateUsageSummary,
        cameraUsageSummary: final.cameraUsageSummary,
        generationContractIssues: final.generationContractIssues || [],
        raw: lastRaw
      };
    } else {
      lastReason = check.reason;
    }

    if (attempt === GENERATION.MAX_RETRIES && bestContractFallback) {
      logger.warn({ attempt, reason: lastReason }, 'GAME_ENGINE using prior schema-valid candidate after correction attempts failed');
      return validatedResultPayload(bestContractFallback.final, {
        model: bestContractFallback.model,
        durationMs: totalDurationMs,
        attempts: attempt,
        raw: bestContractFallback.raw
      });
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

  if (bestContractFallback) {
    return validatedResultPayload(bestContractFallback.final, {
      model: bestContractFallback.model,
      durationMs: totalDurationMs,
      attempts: GENERATION.MAX_RETRIES,
      raw: bestContractFallback.raw
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

function validatedResultPayload(final, { model, durationMs, attempts, raw }) {
  return {
    gameDefinition: final.data,
    model,
    durationMs,
    attempts,
    normalizationWarnings: final.warnings || [],
    debugDiagnostics: final.debugReport?.diagnostics || [],
    debugRepair: final.debugRepair,
    assetUsageSummary: final.assetUsageSummary,
    behaviorStateUsageSummary: final.behaviorStateUsageSummary,
    cameraUsageSummary: final.cameraUsageSummary,
    generationContractIssues: final.generationContractIssues || [],
    raw
  };
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
        normalizationWarnings: toolResult.normalizationWarnings || [],
        debugDiagnostics: toolResult.debugDiagnostics || [],
        debugRepair: toolResult.debugRepair || { attempted: false },
        assetUsageSummary: toolResult.assetUsageSummary,
        behaviorStateUsageSummary: toolResult.behaviorStateUsageSummary,
        cameraUsageSummary: toolResult.cameraUsageSummary,
        generationContractIssues: toolResult.generationContractIssues || [],
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
    normalizationWarnings: result.normalizationWarnings || [],
    debugDiagnostics: result.debugDiagnostics || [],
    debugRepair: result.debugRepair || { attempted: false },
    assetUsageSummary: result.assetUsageSummary,
    behaviorStateUsageSummary: result.behaviorStateUsageSummary,
    cameraUsageSummary: result.cameraUsageSummary,
    generationContractIssues: result.generationContractIssues || [],
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
    normalizationWarnings: validated.normalizationWarnings || [],
    debugDiagnostics: validated.debugDiagnostics || [],
    debugRepair: validated.debugRepair || { attempted: false },
    assetUsageSummary: validated.assetUsageSummary,
    behaviorStateUsageSummary: validated.behaviorStateUsageSummary,
    cameraUsageSummary: validated.cameraUsageSummary,
    generationContractIssues: validated.generationContractIssues || [],
    toolCalling
  };
}

async function validateInitialOrRetry({ initial, prompt, model, brief, assetCandidates, assetManifest, maxOutputTokens }) {
  let totalDurationMs = initial.durationMs;
  let lastModel = initial.model || model || null;
  let lastRaw = initial.raw;
  let lastReason = null;
  let bestContractFallback = null;

  const firstCheck = validateGeneratedGameDefinition(initial.json, assetCandidates);
  if (firstCheck.ok) {
    const final = tryRepairAndValidate(firstCheck, assetCandidates);
    if (shouldRetryGenerationContract(final, 1)) {
      bestContractFallback = { final, model: initial.model, raw: lastRaw };
      lastReason = final.generationContractReason;
      logger.warn({ attempt: 1, via: 'tool-call', reason: lastReason }, 'GAME_ENGINE generation contract needs correction');
    } else {
    logger.info({
      attempt: 1,
      via: 'tool-call',
      schemaOk: true,
      normalizationWarningCount: (final.warnings || []).length,
      diagnostics: summarizeDiagnostics(final.debugReport).diagnostics,
      repaired: final.debugRepair?.accepted || false
    }, 'GAME_ENGINE GameDefinition validation passed');
      return {
        gameDefinition: final.data,
        model: initial.model,
        durationMs: totalDurationMs,
        attempts: 1,
        normalizationWarnings: final.warnings || [],
        debugDiagnostics: final.debugReport?.diagnostics || [],
        debugRepair: final.debugRepair,
        assetUsageSummary: final.assetUsageSummary,
        behaviorStateUsageSummary: final.behaviorStateUsageSummary,
        cameraUsageSummary: final.cameraUsageSummary,
        generationContractIssues: final.generationContractIssues || [],
        raw: lastRaw
      };
    }
  } else {
    lastReason = firstCheck.reason;
  }

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
      const final = tryRepairAndValidate(check, assetCandidates);
      if (shouldRetryGenerationContract(final, attempt)) {
        bestContractFallback = { final, model: result.model, raw: lastRaw };
        lastReason = final.generationContractReason;
        logger.warn({ attempt, via: 'tool-call-retry', reason: lastReason }, 'GAME_ENGINE generation contract needs correction');
        continue;
      }
      logger.info({
        attempt,
        via: 'tool-call-retry',
        schemaOk: true,
        normalizationWarningCount: (final.warnings || []).length,
        diagnostics: summarizeDiagnostics(final.debugReport).diagnostics,
        repaired: final.debugRepair?.accepted || false
      }, 'GAME_ENGINE GameDefinition validation passed');
      return {
        gameDefinition: final.data,
        model: result.model,
        durationMs: totalDurationMs,
        attempts: attempt,
        normalizationWarnings: final.warnings || [],
        debugDiagnostics: final.debugReport?.diagnostics || [],
        debugRepair: final.debugRepair,
        assetUsageSummary: final.assetUsageSummary,
        behaviorStateUsageSummary: final.behaviorStateUsageSummary,
        cameraUsageSummary: final.cameraUsageSummary,
        generationContractIssues: final.generationContractIssues || [],
        raw: lastRaw
      };
    }
    lastReason = check.reason;
  }

  if (bestContractFallback) {
    logger.warn({ reason: lastReason }, 'GAME_ENGINE using prior schema-valid candidate after correction attempts failed');
    return validatedResultPayload(bestContractFallback.final, {
      model: bestContractFallback.model || lastModel,
      durationMs: totalDurationMs,
      attempts: GENERATION.MAX_RETRIES,
      raw: bestContractFallback.raw
    });
  }

  throw new ExternalAPIError(
    lastModel || 'AI provider',
    `GameDefinition validation failed after ${GENERATION.MAX_RETRIES} attempts: ${lastReason || 'unknown validation error'}`
  );
}

/**
 * After a successful schema validation + diagnostics pass, attempt up to
 * MAX_REPAIR_ITERATIONS of deterministic JSON patches for REPAIRABLE_CODES.
 * Re-validates after each iteration. Accepts the repaired candidate only if
 * schema is still valid AND no more repairable diagnostics remain.
 * Falls back to the original validation result if repair cannot fully fix it.
 */
function tryRepairAndValidate(validationResult, assetCandidates, options = {}) {
  // `options.repair` is for tests only: lets us inject a fake repairer to
  // exercise the safety mechanism (rejection of patches that break schema).
  // Production always uses the real `repairGameDefinition`.
  const repair = options.repair || repairGameDefinition;

  const repairableDiags = (validationResult.debugReport?.diagnostics || []).filter((d) => REPAIRABLE_CODES.has(d.code));
  if (repairableDiags.length === 0) {
    return { ...validationResult, debugRepair: { attempted: false, accepted: false, appliedPatches: [], skippedCount: 0 } };
  }

  logger.info({ codes: repairableDiags.map((d) => d.code) }, 'GAME_ENGINE debug repair: starting');

  let current = validationResult.data;
  let currentDiagnostics = validationResult.debugReport.diagnostics;
  const allPatches = [];
  let skippedCount = 0;

  for (let iter = 0; iter < MAX_REPAIR_ITERATIONS; iter += 1) {
    const repairResult = repair(current, currentDiagnostics);
    skippedCount = repairResult.skippedDiagnostics.length;

    if (!repairResult.changed) {
      logger.info({ iter }, 'GAME_ENGINE debug repair: no changes produced, stopping');
      break;
    }

    allPatches.push(...repairResult.appliedPatches);
    logger.info({
      iter,
      patches: repairResult.appliedPatches.map((p) => ({ path: p.path, code: p.diagnosticCode }))
    }, 'GAME_ENGINE debug repair: patches applied');

    const reCheck = validateGeneratedGameDefinition(repairResult.repairedGameDefinition, assetCandidates);
    if (!reCheck.ok) {
      logger.warn({ iter, reason: reCheck.reason }, 'GAME_ENGINE debug repair: re-validation failed, rejecting repaired candidate');
      break;
    }

    const stillRepairable = (reCheck.debugReport?.diagnostics || []).filter((d) => REPAIRABLE_CODES.has(d.code));
    if (stillRepairable.length === 0) {
      logger.info({ iter, totalPatches: allPatches.length }, 'GAME_ENGINE debug repair: accepted');
      return {
        ...reCheck,
        debugRepair: { attempted: true, accepted: true, appliedPatches: allPatches, skippedCount }
      };
    }

    current = reCheck.data;
    currentDiagnostics = reCheck.debugReport.diagnostics;
  }

  logger.info({ attempted: allPatches.length > 0, skippedCount }, 'GAME_ENGINE debug repair: not accepted, using original');
  return {
    ...validationResult,
    debugRepair: { attempted: allPatches.length > 0, accepted: false, appliedPatches: allPatches, skippedCount }
  };
}

function validateGeneratedGameDefinition(json, assetCandidates) {
  const normalizedAssetUse = normalizeCandidateAssetUse(json, assetCandidates);
  const check = validateEngineGameDefinitionSafe(normalizedAssetUse.candidate);
  if (!check.ok) {
    return { ok: false, reason: check.errors.map((error) => `${error.path || '<root>'}: ${error.message}`).join('; ') };
  }
  const assetUseCheck = validateGeneratedAssetUse(check.data, assetCandidates);
  if (!assetUseCheck.ok) return { ok: false, reason: assetUseCheck.reason };
  const warnings = [
    ...(normalizedAssetUse.warnings || []),
    ...(check.warnings || []),
    ...(assetUseCheck.warnings || [])
  ];
  // Stage 1 debug-protocol diagnostics. Additive: never changes retry flow,
  // never mutates check.data. See prototype/backend/src/debugProtocol/.
  const debugReport = runDebugDiagnostics(check.data, {
    schemaResult: { ok: true },
    normalizationWarnings: warnings
  });
  const behaviorStateUsageSummary = buildBehaviorStateUsageSummary(check.data);
  const cameraUsageSummary = buildCameraUsageSummary(check.data);
  const contractCheck = validateGenerationContract({
    debugReport,
    normalizationWarnings: warnings,
    behaviorStateUsageSummary,
    cameraUsageSummary
  });
  return {
    ok: true,
    data: check.data,
    warnings,
    debugReport,
    assetUsageSummary: assetUseCheck.assetUsageSummary,
    behaviorStateUsageSummary,
    cameraUsageSummary,
    generationContractIssues: contractCheck.issues || [],
    generationContractReason: contractCheck.reason || null
  };
}

function shouldRetryGenerationContract(validationResult, attempt) {
  return !!validationResult.generationContractReason && attempt < GENERATION.MAX_RETRIES;
}

function normalizeCandidateAssetUse(json, assetCandidates) {
  if (!assetCandidates.length || !json || typeof json !== 'object' || !Array.isArray(json.assets)) {
    return { candidate: json, warnings: [] };
  }
  const candidate = JSON.parse(JSON.stringify(json));
  const warnings = [];
  const aliases = buildAssetAliases(assetCandidates);
  const keyRemaps = new Map();

  for (const [index, asset] of candidate.assets.entries()) {
    if (!asset || typeof asset !== 'object') continue;
    const source = aliases.get(normalize(asset.key)) || aliases.get(normalize(asset.name)) || aliases.get(normalize(asset.url));
    if (!source) continue;
    if (asset.key !== source.id) {
      keyRemaps.set(asset.key, source.id);
      addNormalizationWarning(warnings, 'normalized.assetCandidateKey', `assets.${index}.key`, asset.key, source.id, 'Generated asset key was normalized to the selected asset id.');
      asset.key = source.id;
    }
    const expectedType = runtimeAssetType(source);
    if (asset.type !== expectedType) {
      addNormalizationWarning(warnings, 'normalized.assetCandidateType', `assets.${index}.type`, asset.type, expectedType, 'Generated asset type was normalized to the selected asset type.');
      asset.type = expectedType;
    }
    if (asset.url !== source.publicPath) {
      addNormalizationWarning(warnings, 'normalized.assetCandidateUrl', `assets.${index}.url`, asset.url, source.publicPath, 'Generated asset URL was normalized to the selected asset public path.');
      asset.url = source.publicPath;
    }
  }

  if (keyRemaps.size) rewriteAssetReferences(candidate, keyRemaps, warnings);
  return { candidate, warnings };
}

function validateGenerationContract({ debugReport, normalizationWarnings = [], behaviorStateUsageSummary, cameraUsageSummary }) {
  const contractFailureCodes = new Set([
    DIAGNOSTIC_CODES.BEHAVIOR_STATE_KEY_MISSING,
    DIAGNOSTIC_CODES.SCENE_HAS_CAMERA_NO_TARGET,
    DIAGNOSTIC_CODES.BEHAVIOR_ACTION_UNSUPPORTED,
    DIAGNOSTIC_CODES.INITIAL_SCENE_NOT_PLAYABLE,
    DIAGNOSTIC_CODES.PLAYABLE_SCENE_NO_PLAYER,
    DIAGNOSTIC_CODES.PLAYABLE_SCENE_NO_GROUND_COLLIDER,
    DIAGNOSTIC_CODES.PLAYABLE_SCENE_NO_BEHAVIOR_RULES
  ]);
  const failingCodes = new Set((debugReport?.diagnostics || [])
    .filter((diagnostic) => contractFailureCodes.has(diagnostic.code))
    .map((diagnostic) => diagnostic.code));
  const reasons = [];
  const diagnostics = debugReport?.diagnostics || [];
  const unsupportedActionWarnings = (normalizationWarnings || [])
    .filter((warning) => warning?.code === 'normalized.actionUnsupportedDropped');
  if (unsupportedActionWarnings.length > 0) {
    failingCodes.add(DIAGNOSTIC_CODES.BEHAVIOR_ACTION_UNSUPPORTED);
  }

  if ((behaviorStateUsageSummary?.missingStateKeys || []).length > 0 || failingCodes.has(DIAGNOSTIC_CODES.BEHAVIOR_STATE_KEY_MISSING)) {
    failingCodes.add(DIAGNOSTIC_CODES.BEHAVIOR_STATE_KEY_MISSING);
    reasons.push(
      `BEHAVIOR_STATE_KEY_MISSING: missingStateKeys=${JSON.stringify(behaviorStateUsageSummary.missingStateKeys)}; ` +
      `declaredStateKeys=${JSON.stringify(behaviorStateUsageSummary.declaredStateKeys)}; ` +
      `referencedStateKeys=${JSON.stringify(behaviorStateUsageSummary.referencedStateKeys)}. ` +
      'Every behavior trigger, condition, or action that references a state key must use a key declared in top-level state.'
    );
  }

  if ((cameraUsageSummary?.scenesMissingCameraTarget || []).length > 0 || failingCodes.has(DIAGNOSTIC_CODES.SCENE_HAS_CAMERA_NO_TARGET)) {
    failingCodes.add(DIAGNOSTIC_CODES.SCENE_HAS_CAMERA_NO_TARGET);
    reasons.push(
      `SCENE_HAS_CAMERA_NO_TARGET: scenesMissingCameraTarget=${JSON.stringify(cameraUsageSummary.scenesMissingCameraTarget)}. ` +
      'Every scene with the camera system must have one entity with cameraTarget; prefer the player entity when available.'
    );
  }

  if (failingCodes.has(DIAGNOSTIC_CODES.BEHAVIOR_ACTION_UNSUPPORTED)) {
    const unsupportedDiagnostics = diagnostics
      .filter((diagnostic) => diagnostic.code === DIAGNOSTIC_CODES.BEHAVIOR_ACTION_UNSUPPORTED)
      .map((diagnostic) => ({ message: diagnostic.message, pointer: diagnostic.jsonPointer, actual: diagnostic.actual }));
    const droppedWarnings = unsupportedActionWarnings
      .map((warning) => ({ path: warning.path, message: warning.message, before: warning.before }));
    reasons.push(
      `BEHAVIOR_ACTION_UNSUPPORTED: diagnostics=${JSON.stringify(unsupportedDiagnostics)}; ` +
      `droppedActions=${JSON.stringify(droppedWarnings)}. ` +
      'Use only supported runtime behavior actions. Do not rely on actions that normalization drops.'
    );
  }

  const playabilityCodes = [
    DIAGNOSTIC_CODES.INITIAL_SCENE_NOT_PLAYABLE,
    DIAGNOSTIC_CODES.PLAYABLE_SCENE_NO_PLAYER,
    DIAGNOSTIC_CODES.PLAYABLE_SCENE_NO_GROUND_COLLIDER,
    DIAGNOSTIC_CODES.PLAYABLE_SCENE_NO_BEHAVIOR_RULES
  ];
  const playabilityDiagnostics = diagnostics
    .filter((diagnostic) => playabilityCodes.includes(diagnostic.code))
    .map((diagnostic) => ({
      code: diagnostic.code,
      message: diagnostic.message,
      pointer: diagnostic.jsonPointer,
      expected: diagnostic.expected,
      actual: diagnostic.actual
    }));
  if (playabilityDiagnostics.length > 0) {
    for (const diagnostic of playabilityDiagnostics) failingCodes.add(diagnostic.code);
    reasons.push(
      `PLAYABILITY_CONTRACT_FAILED: diagnostics=${JSON.stringify(playabilityDiagnostics)}. ` +
      'initialScene must be the gameplay scene and must include a dynamic player, a static ground/platform collider, and supported root/scene behavior rules.'
    );
  }

  if (reasons.length === 0) return { ok: true, issues: [] };
  return {
    ok: false,
    issues: [...failingCodes],
    reason: `Generation contract failed: ${reasons.join(' ')}`
  };
}

const ACTIONS_WITH_STATE_KEY = new Set(['setState', 'incrementState', 'decrementState']);

function buildBehaviorStateUsageSummary(gameDefinition) {
  const declaredStateKeys = uniqueSorted(Object.keys(gameDefinition?.state || {}));
  const declared = new Set(declaredStateKeys);
  const refs = [];

  const addRef = (key, source) => {
    if (typeof key !== 'string' || !key.trim()) return;
    refs.push({ key: key.trim(), source });
  };

  const inspectBehaviors = (behaviors, sourcePrefix) => {
    if (!Array.isArray(behaviors)) return;
    for (let b = 0; b < behaviors.length; b += 1) {
      const behavior = behaviors[b];
      if (!behavior || typeof behavior !== 'object') continue;
      const trigger = behavior.trigger;
      if (trigger && typeof trigger === 'object') {
        addRef(trigger.stateKey || trigger.key, `${sourcePrefix}.${b}.trigger`);
      }
      for (let c = 0; c < (behavior.conditions || []).length; c += 1) {
        const condition = behavior.conditions[c];
        addRef(condition?.stateKey || condition?.key, `${sourcePrefix}.${b}.conditions.${c}`);
      }
      for (let a = 0; a < (behavior.actions || []).length; a += 1) {
        const action = behavior.actions[a];
        const type = action?.type || action?.action;
        if (ACTIONS_WITH_STATE_KEY.has(type)) {
          addRef(action.stateKey || action.key, `${sourcePrefix}.${b}.actions.${a}`);
        }
      }
    }
  };

  inspectBehaviors(gameDefinition?.behaviors, 'behaviors');
  for (let s = 0; s < (gameDefinition?.scenes || []).length; s += 1) {
    inspectBehaviors(gameDefinition.scenes[s]?.behaviors, `scenes.${s}.behaviors`);
  }

  const referencedStateKeys = uniqueSorted(refs.map((ref) => ref.key));
  const missingStateKeys = referencedStateKeys.filter((key) => !declared.has(key));
  const referenced = new Set(referencedStateKeys);
  const unusedStateKeys = declaredStateKeys.filter((key) => !referenced.has(key));

  return {
    declaredStateKeys,
    referencedStateKeys,
    missingStateKeys,
    unusedStateKeys
  };
}

function buildCameraUsageSummary(gameDefinition) {
  const scenesWithCameraSystem = [];
  const scenesMissingCameraTarget = [];

  for (let s = 0; s < (gameDefinition?.scenes || []).length; s += 1) {
    const scene = gameDefinition.scenes[s];
    const systems = Array.isArray(scene?.systems) ? scene.systems : [];
    const entities = Array.isArray(scene?.entities) ? scene.entities : [];
    if (!systems.includes('camera')) continue;
    const sceneKey = scene?.key || `scene_${s}`;
    scenesWithCameraSystem.push(sceneKey);
    const hasTarget = entities.some((entity) => entity?.cameraTarget && typeof entity.cameraTarget === 'object');
    if (hasTarget) continue;
    const preferred = entities.find((entity) => entity?.key === 'player' || (entity?.tags || []).includes('player')) || entities[0] || null;
    scenesMissingCameraTarget.push({
      sceneKey,
      sceneIndex: s,
      preferredTargetKey: preferred?.key || null
    });
  }

  return {
    scenesWithCameraSystem,
    scenesMissingCameraTarget
  };
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
  const ar = result.assetResolution || {};
  const coherence = ar.meta?.coherence || {};
  logger.info({
    model: result.model,
    complexity: toolCalling.complexity,
    toolAttempted: toolCalling.attempted,
    toolUsed: toolCalling.used,
    selectedAssetCount: result.selectedAssets?.length || ar.selectedAssets?.length || 0,
    missingAssetCount: ar.missingAssets?.length || 0,
    substitutionCount: ar.substitutions?.length || 0,
    compatibilityWarningCount: ar.compatibilityWarnings?.length || 0,
    gameType: ar.meta?.gameType || null,
    dominantPack: coherence.dominantGameplayPack || coherence.dominantPack || null,
    toolResultChars: toolCalling.toolResultChars,
    durationMs: result.durationMs,
    fallbackReason: toolCalling.reason || toolCalling.fallbackReason || null
  }, 'Engine generation tool-calling summary');
}

function validateGeneratedAssetUse(gameDefinition, assetCandidates) {
  const assetUsageSummary = buildAssetUsageSummary(gameDefinition, assetCandidates);
  if (!assetCandidates.length) {
    if (assetUsageSummary.invalidAssetKeys.length > 0) {
      return {
        ok: false,
        reason: `Generated asset "${assetUsageSummary.invalidAssetKeys[0]}" is not in the supplied asset candidates.`,
        warnings: [],
        assetUsageSummary
      };
    }
    return { ok: true, warnings: [], assetUsageSummary };
  }
  if (!Array.isArray(gameDefinition.assets)) return { ok: true, warnings: [], assetUsageSummary };

  const allowed = new Map(assetCandidates.map((asset) => [asset.id, asset]));
  const aliases = buildAssetAliases(assetCandidates);
  const keyRemaps = new Map();
  const warnings = [];

  for (const [index, asset] of gameDefinition.assets.entries()) {
    const source = allowed.get(asset.key) || aliases.get(normalize(asset.key)) || aliases.get(normalize(asset.name)) || aliases.get(normalize(asset.url));
    if (!source) {
      return {
        ok: false,
        reason: `Generated asset "${asset.key}" is not in the supplied asset candidates. INVALID_ASSET_DETAILS=${JSON.stringify(invalidAssetDetails(asset))}`,
        warnings,
        assetUsageSummary
      };
    }
    if (asset.key !== source.id) {
      keyRemaps.set(asset.key, source.id);
      addNormalizationWarning(warnings, 'normalized.assetCandidateKey', `assets.${index}.key`, asset.key, source.id, 'Generated asset key was normalized to the selected asset id.');
      asset.key = source.id;
    }
    const expectedType = runtimeAssetType(source);
    if (asset.type !== expectedType) {
      addNormalizationWarning(warnings, 'normalized.assetCandidateType', `assets.${index}.type`, asset.type, expectedType, 'Generated asset type was normalized to the selected asset type.');
      asset.type = expectedType;
    }
    if (asset.url !== source.publicPath) {
      addNormalizationWarning(warnings, 'normalized.assetCandidateUrl', `assets.${index}.url`, asset.url, source.publicPath, 'Generated asset URL was normalized to the selected asset public path.');
      asset.url = source.publicPath;
    }
  }

  if (keyRemaps.size) rewriteAssetReferences(gameDefinition, keyRemaps, warnings);

  return { ok: true, warnings, assetUsageSummary: buildAssetUsageSummary(gameDefinition, assetCandidates) };
}

function buildAssetUsageSummary(gameDefinition, assetCandidates = []) {
  const allowedAssetKeys = uniqueSorted(assetCandidates.map((asset) => asset.id));
  const requiredAssetKeys = uniqueSorted(assetCandidates.filter(isRequiredAssetCandidate).map((asset) => asset.id));
  const allowed = new Set(allowedAssetKeys);
  const declaredAssetKeys = Array.isArray(gameDefinition?.assets)
    ? gameDefinition.assets.map((asset) => asset?.key).filter((key) => typeof key === 'string' && key)
    : [];
  const referencedAssetKeys = collectReferencedAssetKeys(gameDefinition);
  const candidateKeysToCheck = uniqueSorted([...declaredAssetKeys, ...referencedAssetKeys]);
  const invalidAssetKeys = candidateKeysToCheck.filter((key) => !allowed.has(key));
  const usedAssetKeys = referencedAssetKeys.filter((key) => allowed.has(key));
  const usedSet = new Set(usedAssetKeys);
  const unusedAssetKeys = allowedAssetKeys.filter((key) => !usedSet.has(key));
  const usedRequiredAssetKeys = requiredAssetKeys.filter((key) => usedSet.has(key));
  const unusedRequiredAssetKeys = requiredAssetKeys.filter((key) => !usedSet.has(key));

  return {
    allowedAssetCount: allowedAssetKeys.length,
    usedAssetCount: usedAssetKeys.length,
    unusedAssetCount: unusedAssetKeys.length,
    invalidAssetKeys,
    unusedAssetKeys,
    usedAssetKeys,
    requiredAssetUsedCount: usedRequiredAssetKeys.length,
    unusedRequiredAssetKeys
  };
}

function isRequiredAssetCandidate(asset) {
  const role = normalize(asset?.role);
  const confidence = Number(asset?.confidenceScore || 0);
  if (confidence < 0.65) return false;
  return ['player', 'main-character', 'character', 'environment', 'terrain', 'platform', 'world', 'enemy', 'main-enemy'].includes(role);
}

function invalidAssetDetails(asset) {
  return {
    key: asset?.key || null,
    type: asset?.type || null,
    name: asset?.name || null,
    url: asset?.url || null,
    role: inferRoleFromAssetLike(asset),
    dimension: inferDimensionFromAssetLike(asset)
  };
}

function collectReferencedAssetKeys(gameDefinition) {
  const keys = [];
  const collectEntity = (entity) => {
    if (!entity || typeof entity !== 'object') return;
    if (typeof entity.model?.assetKey === 'string') keys.push(entity.model.assetKey);
    if (entity.sprite?.kind === 'image' && typeof entity.sprite.assetKey === 'string') keys.push(entity.sprite.assetKey);
  };

  for (const scene of gameDefinition?.scenes || []) {
    for (const entity of scene.entities || []) collectEntity(entity);
    collectAudioKeys(scene.audio, keys);
    collectBehaviorAssetKeys(scene.behaviors, keys);
  }
  for (const prefab of Object.values(gameDefinition?.prefabs || {})) collectEntity(prefab);
  collectAudioKeys(gameDefinition?.audio, keys);
  collectBehaviorAssetKeys(gameDefinition?.behaviors, keys);
  return uniqueSorted(keys);
}

function collectAudioKeys(rules, keys) {
  if (!Array.isArray(rules)) return;
  for (const rule of rules) {
    const key = rule?.asset || rule?.sound;
    if (typeof key === 'string' && key) keys.push(key);
  }
}

function collectBehaviorAssetKeys(behaviors, keys) {
  if (!Array.isArray(behaviors)) return;
  for (const behavior of behaviors) {
    for (const action of behavior?.actions || []) {
      if (action?.type !== 'playSound') continue;
      const key = action.asset || action.sound;
      if (typeof key === 'string' && key) keys.push(key);
    }
  }
}

function uniqueSorted(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()))].sort();
}

function buildAssetAliases(assetCandidates) {
  const aliases = new Map();
  for (const asset of assetCandidates) {
    const keys = [
      asset.id,
      asset.name,
      asset.publicPath,
      asset.sourceRelativePath,
      asset.source?.relativePath
    ];
    for (const key of keys) {
      const normalized = normalize(key);
      if (normalized && !aliases.has(normalized)) aliases.set(normalized, asset);
    }
  }
  return aliases;
}

function rewriteAssetReferences(gameDefinition, keyRemaps, warnings = []) {
  const entities = [
    ...(gameDefinition.scenes || []).flatMap((scene) => scene.entities || []),
    ...Object.values(gameDefinition.prefabs || {})
  ];

  for (const entity of entities) {
    if (entity.model?.assetKey && keyRemaps.has(entity.model.assetKey)) {
      const before = entity.model.assetKey;
      entity.model.assetKey = keyRemaps.get(entity.model.assetKey);
      addNormalizationWarning(warnings, 'normalized.assetReferenceKey', `entities.${entity.key || '<unknown>'}.model.assetKey`, before, entity.model.assetKey, 'Model asset reference was normalized to the selected asset id.');
    }
    if (entity.sprite?.assetKey && keyRemaps.has(entity.sprite.assetKey)) {
      const before = entity.sprite.assetKey;
      entity.sprite.assetKey = keyRemaps.get(entity.sprite.assetKey);
      addNormalizationWarning(warnings, 'normalized.assetReferenceKey', `entities.${entity.key || '<unknown>'}.sprite.assetKey`, before, entity.sprite.assetKey, 'Sprite asset reference was normalized to the selected asset id.');
    }
  }
}

function addNormalizationWarning(warnings, code, path, before, after, message) {
  warnings.push({ code, path, before, after, message });
}

function runtimeAssetType(asset) {
  if (normalize(asset.type) === 'gltf') return 'gltf';
  if (normalize(asset.type) === 'spritesheet') return 'spritesheet';
  if (normalize(asset.type) === 'atlas') return 'atlas';
  if (normalize(asset.type) === 'tilemap') return 'tilemap';
  if (normalize(asset.type) === 'audio') return 'audio';
  return 'image';
}

function inferRoleFromAssetLike(asset) {
  const text = normalize([asset?.key, asset?.name, asset?.url].filter(Boolean).join(' '));
  if (text.includes('ui') || text.includes('hud') || text.includes('button') || text.includes('arrow')) return 'ui';
  if (text.includes('player') || text.includes('hero') || text.includes('character')) return 'player';
  if (text.includes('enemy') || text.includes('monster')) return 'enemy';
  if (text.includes('coin') || text.includes('gem') || text.includes('collect')) return 'collectible';
  if (text.includes('ground') || text.includes('platform') || text.includes('terrain')) return 'platform';
  if (text.includes('sound') || text.includes('audio') || text.includes('music')) return 'audio';
  return null;
}

function inferDimensionFromAssetLike(asset) {
  const type = normalize(asset?.type);
  if (type === 'gltf') return '3D';
  if (['image', 'spritesheet', 'atlas', 'tilemap'].includes(type)) return '2D';
  return null;
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
    role: asset.role,
    dimension: asset.dimension || asset.assetDimension,
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
  buildAssetUsageSummary,
  buildBehaviorStateUsageSummary,
  buildCameraUsageSummary,
  sanitizeResolveAssetsToolArgs,
  resolveAssetsForBriefToolSchema,
  // Exported for integration testing (Stage 2B):
  validateGeneratedGameDefinition,
  tryRepairAndValidate
};
