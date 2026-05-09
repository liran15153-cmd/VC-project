/* ============================================================================
   Game Generation Routes
   ========================================================================= */

const express = require('express');
const validate = require('../middleware/validate');
const { generateGameSchema, editGameSchema } = require('../schemas/apiSchemas');
const { validateGameJSONSafe } = require('../schemas/gameSchemas');
const { generateJSON } = require('../services/openaiService');
const { buildGenerationPrompt, buildEditPrompt } = require('../services/promptService');
const { getGameSystemPrompt } = require('../services/systemPrompts');
const { buildGameHTML } = require('../services/templateBuilder');
const { buildAssetManifest } = require('../services/assetService');
const fallbackAI = require('../services/fallbackAIService');
const { shouldUseMockForTask } = require('../services/aiModeService');
const config = require('../config/env');
const logger = require('../utils/logger');
const { GENERATION } = require('../config/constants');
const { ExternalAPIError } = require('../utils/errors');

const router = express.Router();

function validateAIGameJSON(json, expectedDimension) {
  const loose = validateGameJSONSafe(json, 'loose');
  if (!loose.ok) {
    return { ok: false, reason: `Loose validation failed: ${loose.errors.map(e => `${e.path}:${e.message}`).join(', ')}` };
  }
  if (json.metadata.dimension !== expectedDimension) {
    return { ok: false, reason: `Wrong dimension: got ${json.metadata.dimension}, expected ${expectedDimension}` };
  }

  const strict = validateGameJSONSafe(json, 'strict');
  if (!strict.ok) {
    return { ok: false, reason: `Schema validation failed: ${strict.errors.slice(0, 3).map(e => `${e.path}:${e.message}`).join(', ')}` };
  }

  return { ok: true, data: strict.data };
}

async function generateWithRetries({ systemPrompt, userPrompt, model, expectedDimension }) {
  let lastError = null;
  let correctivePrompt = userPrompt;

  for (let attempt = 1; attempt <= GENERATION.MAX_RETRIES; attempt++) {
    try {
      const result = await generateJSON({
        prompt: correctivePrompt,
        systemPrompt,
        model,
        generationConfig: { maxOutputTokens: 12000 }
      });
      const check = validateAIGameJSON(result.json, expectedDimension);

      if (check.ok) {
        return { gameJSON: check.data, model: result.model, durationMs: result.durationMs, attempts: attempt };
      }

      lastError = check.reason;
      logger.warn({ attempt, reason: check.reason }, 'Validation failed, retrying');
      correctivePrompt = `${userPrompt}\n\nPREVIOUS ATTEMPT FAILED VALIDATION: ${check.reason}\nFix the issue and return valid JSON only.`;
    } catch (err) {
      lastError = err.message;
      logger.warn({ attempt, err: err.message }, 'Generation attempt failed');
      if (fallbackAI.shouldUseFallback(err)) throw err;
      if (attempt === GENERATION.MAX_RETRIES) throw err;
    }
  }

  throw new ExternalAPIError(config.ai.providerLabel, `Validation failed after ${GENERATION.MAX_RETRIES} attempts: ${lastError}`);
}

function validateFallbackGame(gameJSON, expectedDimension) {
  const check = validateAIGameJSON(gameJSON, expectedDimension);
  if (!check.ok) {
    throw new ExternalAPIError('LocalFallback', check.reason);
  }
  return check.data;
}

async function generateGameOrFallback({ prompt, answers, gameType, dimension, userPrompt, model }) {
  if (shouldUseMockForTask('game-json', { prompt, answers, gameType, dimension })) {
    const gameJSON = validateFallbackGame(
      fallbackAI.generateGame({ prompt, answers, gameType, dimension }),
      dimension
    );
    return {
      gameJSON,
      model: 'local-mock',
      durationMs: 0,
      attempts: 0,
      fallback: false
    };
  }

  try {
    const result = await generateWithRetries({
      systemPrompt: getGameSystemPrompt(dimension),
      userPrompt,
      model,
      expectedDimension: dimension
    });
    return { ...result, fallback: false };
  } catch (err) {
    if (!config.ai.fallbackEnabled || !fallbackAI.shouldUseFallback(err)) throw err;

    logger.warn({ err: err.message, dimension, gameType }, 'Using local fallback game generator');
    const gameJSON = validateFallbackGame(
      fallbackAI.generateGame({ prompt, answers, gameType, dimension }),
      dimension
    );
    return {
      gameJSON,
      model: 'local-fallback',
      durationMs: 0,
      attempts: 0,
      fallback: true,
      fallbackReason: err.message
    };
  }
}

async function editGameOrFallback({ sourceGameJSON, editPrompt, userPrompt, model, dimension }) {
  if (shouldUseMockForTask('game-json-edit', { prompt: editPrompt, dimension })) {
    const gameJSON = validateFallbackGame(
      fallbackAI.editGame({ gameJSON: sourceGameJSON, editPrompt }),
      dimension
    );
    return {
      gameJSON,
      model: 'local-mock',
      durationMs: 0,
      attempts: 0,
      fallback: false
    };
  }

  try {
    const result = await generateWithRetries({
      systemPrompt: getGameSystemPrompt(dimension),
      userPrompt,
      model,
      expectedDimension: dimension
    });
    return { ...result, fallback: false };
  } catch (err) {
    if (!config.ai.fallbackEnabled || !fallbackAI.shouldUseFallback(err)) throw err;

    logger.warn({ err: err.message, dimension }, 'Using local fallback edit generator');
    const gameJSON = validateFallbackGame(
      fallbackAI.editGame({ gameJSON: sourceGameJSON, editPrompt }),
      dimension
    );
    return {
      gameJSON,
      model: 'local-fallback',
      durationMs: 0,
      attempts: 0,
      fallback: true,
      fallbackReason: err.message
    };
  }
}

router.post('/generate-game', validate(generateGameSchema), async (req, res, next) => {
  const { prompt, answers, gameType, dimension, model } = req.body;
  const start = Date.now();

  try {
    const userPrompt = buildGenerationPrompt({ prompt, answers, gameType, dimension });
    const result = await generateGameOrFallback({
      prompt,
      answers,
      gameType,
      dimension,
      userPrompt,
      model
    });

    const htmlString = buildGameHTML(result.gameJSON);
    const assetManifest = buildAssetManifest(result.gameJSON);
    const totalDurationMs = Date.now() - start;

    res.json({
      gameId: null,
      gameJSON: result.gameJSON,
      htmlString,
      assetManifest,
      meta: {
        provider: config.ai.provider,
        mode: config.ai.mode,
        model: result.model,
        durationMs: totalDurationMs,
        attempts: result.attempts,
        fallback: result.fallback,
        fallbackReason: result.fallbackReason,
        persistence: 'supabase_pending'
      }
    });
  } catch (err) {
    next(err);
  }
});

router.post('/edit-game', validate(editGameSchema), async (req, res, next) => {
  const { gameJSON: sourceGameJSON, editPrompt, model } = req.body;
  const start = Date.now();

  try {
    const dimension = sourceGameJSON.metadata.dimension;
    const userPrompt = buildEditPrompt({ gameJSON: sourceGameJSON, editPrompt });
    const result = await editGameOrFallback({
      sourceGameJSON,
      editPrompt,
      userPrompt,
      model,
      dimension
    });

    const htmlString = buildGameHTML(result.gameJSON);
    const assetManifest = buildAssetManifest(result.gameJSON);
    const totalDurationMs = Date.now() - start;

    res.json({
      gameId: null,
      gameJSON: result.gameJSON,
      htmlString,
      assetManifest,
      meta: {
        provider: config.ai.provider,
        mode: config.ai.mode,
        model: result.model,
        durationMs: totalDurationMs,
        attempts: result.attempts,
        fallback: result.fallback,
        fallbackReason: result.fallbackReason,
        persistence: 'supabase_pending'
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
