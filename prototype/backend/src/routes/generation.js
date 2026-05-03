/* ============================================================================
   Game Generation Routes
   ========================================================================= */

const express = require('express');
const validate = require('../middleware/validate');
const { requireAuth, ensureSelfOrAdmin } = require('../middleware/auth');
const { generateGameSchema, editGameSchema } = require('../schemas/apiSchemas');
const { validateGameJSONSafe } = require('../schemas/gameSchemas');
const { generateJSON } = require('../services/openaiService');
const { buildGenerationPrompt, buildEditPrompt } = require('../services/promptService');
const { getGameSystemPrompt } = require('../services/systemPrompts');
const { buildGameHTML } = require('../services/templateBuilder');
const { buildAssetManifest } = require('../services/assetService');
const fallbackAI = require('../services/fallbackAIService');
const config = require('../config/env');
const tokenService = require('../services/tokenService');
const games = require('../db/games');
const analytics = require('../db/analytics');
const logger = require('../utils/logger');
const { EVENT_TYPES, TOKEN_COSTS, GENERATION } = require('../config/constants');
const { ExternalAPIError, NotFoundError } = require('../utils/errors');

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
      analytics.logEvent({
        eventType: EVENT_TYPES.VALIDATION_FAILED,
        errorMessage: check.reason,
        metadata: { attempt, expectedDimension }
      });

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

router.post('/generate-game', requireAuth, validate(generateGameSchema), async (req, res, next) => {
  const { prompt, answers, gameType, dimension, model, saveToDb } = req.body;
  const userId = req.user.id;
  const start = Date.now();

  try {
    tokenService.spend({
      userId,
      amount: TOKEN_COSTS.NEW_GAME,
      actionType: 'create',
      metadata: { source: 'generate-game', gameType, dimension }
    });

    analytics.logEvent({
      eventType: EVENT_TYPES.GENERATION_STARTED,
      userId,
      metadata: { gameType, dimension, model }
    });

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

    let savedGame = null;
    if (saveToDb) {
      savedGame = games.createGame({
        title: result.gameJSON.metadata.gameTitle,
        description: result.gameJSON.metadata.description,
        genre: result.gameJSON.metadata.genre,
        dimension: result.gameJSON.metadata.dimension,
        difficulty: result.gameJSON.metadata.difficulty,
        gameJSON: result.gameJSON,
        htmlString,
        assetManifest,
        prompt,
        mcqAnswers: answers,
        userId
      });
    }

    analytics.logPrompt({
      gameId: savedGame?.id,
      userId,
      prompt,
      promptType: 'generate',
      mcqAnswers: answers,
      modelUsed: result.model,
      tokensUsed: TOKEN_COSTS.NEW_GAME
    });
    analytics.logEvent({
      eventType: EVENT_TYPES.GENERATION_SUCCEEDED,
      gameId: savedGame?.id,
      userId,
      generationTimeMs: totalDurationMs,
      metadata: { gameType, dimension, model: result.model, attempts: result.attempts, fallback: result.fallback }
    });

    res.json({
      gameId: savedGame?.id || null,
      gameJSON: result.gameJSON,
      htmlString,
      assetManifest,
      meta: {
        provider: config.ai.provider,
        model: result.model,
        durationMs: totalDurationMs,
        attempts: result.attempts,
        fallback: result.fallback,
        fallbackReason: result.fallbackReason,
        savedGameId: savedGame?.id,
        tokens: tokenService.getBalance(userId)
      }
    });
  } catch (err) {
    analytics.logEvent({
      eventType: EVENT_TYPES.GENERATION_FAILED,
      userId,
      generationTimeMs: Date.now() - start,
      errorMessage: err.message,
      metadata: { gameType, dimension }
    });
    next(err);
  }
});

router.post('/edit-game', requireAuth, validate(editGameSchema), async (req, res, next) => {
  const { gameId, editPrompt, model, saveToDb } = req.body;
  const userId = req.user.id;
  const start = Date.now();

  try {
    let sourceGameJSON = req.body.gameJSON;
    let existing = null;

    if (gameId) {
      existing = games.getGame(gameId);
      if (!existing) throw new NotFoundError('Game');
      ensureSelfOrAdmin(req, existing.userId);
      sourceGameJSON = existing.gameJSON;
    }

    const dimension = sourceGameJSON.metadata.dimension;

    tokenService.spend({
      userId,
      gameId: gameId || null,
      amount: TOKEN_COSTS.EDIT_GAME,
      actionType: 'edit',
      metadata: { source: 'edit-game', dimension }
    });

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

    let updatedGame = null;
    if (saveToDb && gameId) {
      updatedGame = games.updateGame(gameId, {
        title: result.gameJSON.metadata.gameTitle,
        description: result.gameJSON.metadata.description,
        genre: result.gameJSON.metadata.genre,
        dimension: result.gameJSON.metadata.dimension,
        gameJSON: result.gameJSON,
        htmlString,
        assetManifest,
        difficulty: result.gameJSON.metadata.difficulty
      });
    }

    analytics.logPrompt({
      gameId,
      userId,
      prompt: editPrompt,
      promptType: 'edit',
      modelUsed: result.model,
      tokensUsed: TOKEN_COSTS.EDIT_GAME
    });
    analytics.logEvent({
      eventType: EVENT_TYPES.GAME_EDITED,
      gameId,
      userId,
      generationTimeMs: totalDurationMs,
      metadata: { dimension, model: result.model, attempts: result.attempts, fallback: result.fallback }
    });

    res.json({
      gameId: updatedGame?.id || gameId || null,
      gameJSON: result.gameJSON,
      htmlString,
      assetManifest,
      meta: {
        provider: config.ai.provider,
        model: result.model,
        durationMs: totalDurationMs,
        attempts: result.attempts,
        fallback: result.fallback,
        fallbackReason: result.fallbackReason,
        savedGameId: updatedGame?.id,
        tokens: tokenService.getBalance(userId)
      }
    });
  } catch (err) {
    analytics.logEvent({
      eventType: EVENT_TYPES.GENERATION_FAILED,
      userId,
      gameId,
      generationTimeMs: Date.now() - start,
      errorMessage: err.message,
      metadata: { source: 'edit' }
    });
    next(err);
  }
});

module.exports = router;
