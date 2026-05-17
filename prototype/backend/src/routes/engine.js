/* ============================================================================
   GAME_ENGINE Generation Routes
   ----------------------------------------------------------------------------
   Development endpoint for generating the new declarative GameDefinition shape
   that GAME_ENGINE can validate and run directly.
   ========================================================================= */

const express = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const { engineFromBriefGenerateSchema, modelSchema } = require('../schemas/apiSchemas');
const { GENERATION } = require('../config/constants');
const {
  generateEngineGameFromBrief,
  generateEngineGameWithRetries
} = require('../services/engineGenerationService');
const { ExternalAPIError } = require('../utils/errors');
const config = require('../config/env');
const { buildDiagnosticsSummary } = require('../debugProtocol/diagnostics');

const router = express.Router();

const engineGenerateSchema = z.object({
  prompt: z.string()
    .trim()
    .min(1, 'prompt cannot be empty')
    .max(GENERATION.MAX_PROMPT_LENGTH, `prompt too long (max ${GENERATION.MAX_PROMPT_LENGTH} chars)`),
  model: modelSchema
});

router.post('/generate', validate(engineGenerateSchema), async (req, res, next) => {
  try {
    const result = await generateEngineGameWithRetries(req.body);

    res.json({
      gameDefinition: result.gameDefinition,
      meta: {
        provider: config.ai.provider,
        model: result.model,
        durationMs: result.durationMs,
        attempts: result.attempts,
        normalizationWarningCount: result.normalizationWarnings?.length || 0,
        persistence: 'supabase_pending'
      }
    });
  } catch (err) {
    next(toUserFacingGenerationError(err));
  }
});

router.post('/from-brief', validate(engineFromBriefGenerateSchema), async (req, res, next) => {
  try {
    const debug = req.body.debug || req.query.debug === 'true' || req.query.debug === '1';
    const result = await generateEngineGameFromBrief({ ...req.body, debug });

    const ar = result.assetResolution || {};
    const coherence = ar.meta?.coherence || {};
    const debugDiagnostics = result.debugDiagnostics || [];
    const normalizationWarnings = result.normalizationWarnings || [];
    const debugRepair = result.debugRepair || { attempted: false, accepted: false, appliedPatches: [], skippedCount: 0 };
    res.json({
      brief: result.brief,
      selectedAssets: result.selectedAssets,
      assetResolution: result.assetResolution,
      assetManifest: result.assetManifest,
      gameDefinition: result.gameDefinition,
      assetUsageSummary: result.assetUsageSummary,
      behaviorStateUsageSummary: result.behaviorStateUsageSummary,
      cameraUsageSummary: result.cameraUsageSummary,
      generationContractIssues: result.generationContractIssues || [],
      normalizationWarnings,
      debugDiagnostics,
      debugDiagnosticsSummary: buildDiagnosticsSummary(debugDiagnostics),
      debugRepair,
      meta: {
        provider: config.ai.provider,
        model: result.model,
        durationMs: result.durationMs,
        attempts: result.attempts,
        selectedAssetCount: result.selectedAssets.length,
        compatibilityWarningCount: Array.isArray(ar.compatibilityWarnings) ? ar.compatibilityWarnings.length : 0,
        missingAssetCount: Array.isArray(ar.missingAssets) ? ar.missingAssets.length : 0,
        substitutionCount: Array.isArray(ar.substitutions) ? ar.substitutions.length : 0,
        dominantPack: coherence.dominantGameplayPack || coherence.dominantPack || null,
        gameType: ar.meta?.gameType || null,
        toolCalling: result.toolCalling,
        normalizationWarningCount: normalizationWarnings.length,
        debugDiagnosticErrorCount: debugDiagnostics.filter((d) => d.severity === 'error').length,
        debugDiagnosticWarningCount: debugDiagnostics.filter((d) => d.severity === 'warning').length,
        debugRepairAccepted: debugRepair.accepted || false,
        debugRepairPatchCount: debugRepair.appliedPatches?.length || 0,
        assetUsageSummary: result.assetUsageSummary,
        behaviorStateUsageSummary: result.behaviorStateUsageSummary,
        cameraUsageSummary: result.cameraUsageSummary,
        generationContractIssueCount: result.generationContractIssues?.length || 0,
        persistence: 'supabase_pending'
      },
      ...(debug ? { debug: { toolCalling: result.toolCalling } } : {})
    });
  } catch (err) {
    next(toUserFacingGenerationError(err));
  }
});

function toUserFacingGenerationError(err) {
  const message = String(err?.message || err || '');
  const lower = message.toLowerCase();
  if (lower.includes('quota') || lower.includes('429') || lower.includes('too many requests') || lower.includes('rate limit')) {
    return new ExternalAPIError('AI provider', 'quota exceeded or rate limited. Check provider billing/quota, wait, or try a different configured model.');
  }
  if (lower.includes('openai_api_key') || lower.includes('openrouter_api_key') || lower.includes('api key') || lower.includes('not configured')) {
    return err;
  }
  return err;
}

module.exports = router;
