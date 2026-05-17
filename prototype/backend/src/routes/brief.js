/* ============================================================================
   Game Brief Agent Routes
   ----------------------------------------------------------------------------
   Planning-only AI flow. This does not generate playable code.
   ========================================================================= */

const express = require('express');
const validate = require('../middleware/validate');
const { gameBriefGenerateSchema, gameBriefSchema } = require('../schemas/apiSchemas');
const { buildGameBriefPrompt } = require('../services/promptService');
const { GAME_BRIEF_SYSTEM_PROMPT } = require('../services/systemPrompts');
const { generateValidatedJSON } = require('../services/jsonAgentService');
const { shouldUseMockForTask } = require('../services/aiModeService');
const fallbackAI = require('../services/fallbackAIService');
const { classifyArchetype } = require('../classifier');
const config = require('../config/env');
const logger = require('../utils/logger');

const router = express.Router();

function classifierMetaFor(classification) {
  return {
    archetype: classification.archetype,
    dimension: classification.dimension,
    confidenceScore: classification.confidenceScore,
    source: classification.source,
    dimensionSource: classification.dimensionSource,
    reasoningShort: classification.reasoningShort,
    warnings: classification.warnings || []
  };
}

async function generateBriefOrFallback({ prompt, answers, gameType, dimension, existingAssets, model }) {
  const classification = classifyArchetype({
    rawPrompt: prompt,
    mcqAnswers: answers,
    dimension,
    gameType
  });
  const resolvedDimension = classification.dimension;
  const archetypeProfile = classification.archetypeProfile;

  if (shouldUseMockForTask('brief', { prompt, answers, gameType, dimension: resolvedDimension })) {
    const mock = gameBriefSchema.parse(fallbackAI.generateBrief({ prompt, answers, gameType, dimension: resolvedDimension, existingAssets }));
    return {
      brief: mock.brief,
      model: 'local-mock',
      durationMs: 0,
      fallback: false,
      tokenOptimized: true,
      classification
    };
  }

  const userPrompt = buildGameBriefPrompt({
    prompt,
    answers,
    gameType,
    dimension: resolvedDimension,
    existingAssets,
    archetype: archetypeProfile
  });

  try {
    const result = await generateValidatedJSON({
      schema: gameBriefSchema,
      systemPrompt: GAME_BRIEF_SYSTEM_PROMPT,
      prompt: userPrompt,
      model,
      generationConfig: { temperature: 0.4, maxOutputTokens: 6500 },
      cacheKey: {
        task: 'game-brief',
        prompt,
        answers,
        gameType,
        dimension: resolvedDimension,
        archetype: classification.archetype,
        existingAssets,
        model
      },
      repairLabel: 'Game Brief'
    });

    return {
      brief: result.json.brief,
      model: result.model,
      durationMs: result.durationMs,
      fallback: false,
      schemaRepair: result.schemaRepair,
      cached: result.cached,
      tokenOptimization: result.tokenOptimization,
      classification
    };
  } catch (err) {
    if (!config.ai.fallbackEnabled || !fallbackAI.shouldUseFallback(err)) throw err;

    logger.warn({ err: err.message, gameType, dimension: resolvedDimension, archetype: classification.archetype }, 'Using deterministic Game Brief fallback');
    const mock = gameBriefSchema.parse(fallbackAI.generateBrief({ prompt, answers, gameType, dimension: resolvedDimension, existingAssets }));
    return {
      brief: mock.brief,
      model: 'local-mock',
      durationMs: 0,
      fallback: true,
      fallbackReason: err.message,
      classification
    };
  }
}

router.post('/generate', validate(gameBriefGenerateSchema), async (req, res, next) => {
  try {
    const result = await generateBriefOrFallback(req.body);
    res.json({
      brief: result.brief,
      meta: {
        provider: config.ai.provider,
        mode: config.ai.mode,
        model: result.model,
        durationMs: result.durationMs,
        fallback: result.fallback,
        fallbackReason: result.fallbackReason,
        schemaRepair: result.schemaRepair,
        cached: result.cached,
        tokenOptimization: result.tokenOptimization,
        codeGenerated: false,
        classifier: result.classification ? classifierMetaFor(result.classification) : null
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
