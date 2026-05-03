/* ============================================================================
   GAME_ENGINE Generation Routes
   ----------------------------------------------------------------------------
   Development endpoint for generating the new declarative GameDefinition shape
   that GAME_ENGINE can validate and run directly.
   ========================================================================= */

const express = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { modelSchema } = require('../schemas/apiSchemas');
const { EVENT_TYPES, GENERATION, TOKEN_COSTS } = require('../config/constants');
const { generateJSON } = require('../services/openaiService');
const tokenService = require('../services/tokenService');
const analytics = require('../db/analytics');
const {
  ENGINE_GAME_SYSTEM_PROMPT,
  buildEngineGenerationPrompt,
  buildEngineCorrectionPrompt
} = require('../services/enginePromptService');
const { validateEngineGameDefinitionSafe } = require('../schemas/engineGameDefinitionSchema');
const { ExternalAPIError } = require('../utils/errors');
const logger = require('../utils/logger');
const config = require('../config/env');

const router = express.Router();

const engineGenerateSchema = z.object({
  prompt: z.string()
    .trim()
    .min(1, 'prompt cannot be empty')
    .max(GENERATION.MAX_PROMPT_LENGTH, `prompt too long (max ${GENERATION.MAX_PROMPT_LENGTH} chars)`),
  model: modelSchema
});

async function generateEngineGameWithRetries({ prompt, model }) {
  let lastReason = null;
  let userPrompt = buildEngineGenerationPrompt({ prompt });
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
      return {
        gameDefinition: check.data,
        model: result.model,
        durationMs: totalDurationMs,
        attempts: attempt
      };
    }

    lastReason = check.errors.map((error) => `${error.path || '<root>'}: ${error.message}`).join('; ');
    logger.warn({ attempt, reason: lastReason }, 'GAME_ENGINE GameDefinition validation failed');
    userPrompt = buildEngineCorrectionPrompt({ originalPrompt: prompt, validationReason: lastReason });
  }

  throw new ExternalAPIError(
    lastModel || 'AI provider',
    `GameDefinition validation failed after ${GENERATION.MAX_RETRIES} attempts: ${lastReason || 'unknown validation error'}`
  );
}

router.post('/generate', requireAuth, validate(engineGenerateSchema), async (req, res, next) => {
  try {
    tokenService.spend({
      userId: req.user.id,
      amount: TOKEN_COSTS.NEW_GAME,
      actionType: 'create',
      metadata: { source: 'engine-generate' }
    });

    const result = await generateEngineGameWithRetries(req.body);
    analytics.logEvent({
      eventType: EVENT_TYPES.GENERATION_SUCCEEDED,
      userId: req.user.id,
      generationTimeMs: result.durationMs,
      metadata: { source: 'engine-generate', model: result.model, attempts: result.attempts }
    });

    res.json({
      gameDefinition: result.gameDefinition,
      meta: {
        provider: config.ai.provider,
        model: result.model,
        durationMs: result.durationMs,
        attempts: result.attempts,
        tokens: tokenService.getBalance(req.user.id)
      }
    });
  } catch (err) {
    analytics.logEvent({
      eventType: EVENT_TYPES.GENERATION_FAILED,
      userId: req.user?.id,
      errorMessage: err.message,
      metadata: { source: 'engine-generate' }
    });
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
