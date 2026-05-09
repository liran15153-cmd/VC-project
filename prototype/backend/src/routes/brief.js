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
const config = require('../config/env');
const logger = require('../utils/logger');

const router = express.Router();

async function generateBriefOrFallback({ prompt, answers, gameType, dimension, existingAssets, model }) {
  if (shouldUseMockForTask('brief', { prompt, answers, gameType, dimension })) {
    const mock = gameBriefSchema.parse(fallbackAI.generateBrief({ prompt, answers, gameType, dimension, existingAssets }));
    return {
      brief: mock.brief,
      model: 'local-mock',
      durationMs: 0,
      fallback: false,
      tokenOptimized: true
    };
  }

  const userPrompt = buildGameBriefPrompt({ prompt, answers, gameType, dimension, existingAssets });

  try {
    const result = await generateValidatedJSON({
      schema: gameBriefSchema,
      systemPrompt: GAME_BRIEF_SYSTEM_PROMPT,
      prompt: userPrompt,
      model,
      generationConfig: { temperature: 0.4, maxOutputTokens: 6500 },
      cacheKey: { task: 'game-brief', prompt, answers, gameType, dimension, existingAssets, model },
      repairLabel: 'Game Brief'
    });

    return {
      brief: result.json.brief,
      model: result.model,
      durationMs: result.durationMs,
      fallback: false,
      schemaRepair: result.schemaRepair,
      cached: result.cached,
      tokenOptimization: result.tokenOptimization
    };
  } catch (err) {
    if (!config.ai.fallbackEnabled || !fallbackAI.shouldUseFallback(err)) throw err;

    logger.warn({ err: err.message, gameType, dimension }, 'Using deterministic Game Brief fallback');
    const mock = gameBriefSchema.parse(fallbackAI.generateBrief({ prompt, answers, gameType, dimension, existingAssets }));
    return {
      brief: mock.brief,
      model: 'local-mock',
      durationMs: 0,
      fallback: true,
      fallbackReason: err.message
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
        codeGenerated: false
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
