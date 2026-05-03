/* ============================================================================
   Games CRUD Routes
   ========================================================================= */

const express = require('express');
const validate = require('../middleware/validate');
const { requireAuth, ensureSelfOrAdmin } = require('../middleware/auth');
const games = require('../db/games');
const analytics = require('../db/analytics');
const { buildGameHTML } = require('../services/templateBuilder');
const { streamGameZip } = require('../services/downloadService');
const { buildAssetManifest } = require('../services/assetService');
const {
  gameCreateSchema,
  gameUpdateSchema,
  gameQuerySchema,
  idParamSchema
} = require('../schemas/apiSchemas');
const { validateGameJSONStrict } = require('../schemas/gameSchemas');
const { NotFoundError } = require('../utils/errors');
const { EVENT_TYPES } = require('../config/constants');

const router = express.Router();

function assertCanAccess(req, game) {
  if (!game) throw new NotFoundError('Game');
  ensureSelfOrAdmin(req, game.userId);
}

router.get('/', requireAuth, validate(gameQuerySchema, 'query'), (req, res) => {
  const requestedUserId = req.query.userId;
  const userId = req.user.role === 'admin' && requestedUserId ? requestedUserId : req.user.id;
  const { limit, offset, orderBy } = req.query;
  const items = games.getAllGames({ userId, limit, offset, orderBy });
  const total = games.countGames(userId);
  res.json({
    items,
    total,
    pagination: {
      limit: limit || 100,
      offset: offset || 0,
      hasMore: (offset || 0) + items.length < total
    }
  });
});

router.post('/', requireAuth, validate(gameCreateSchema), (req, res) => {
  const data = req.body;
  const validatedJSON = validateGameJSONStrict(data.gameJSON);
  const meta = validatedJSON.metadata;
  const htmlString = data.htmlString || buildGameHTML(validatedJSON);
  const assetManifest = data.assetManifest || buildAssetManifest(validatedJSON);

  const created = games.createGame({
    title: data.title,
    description: data.description || meta.description,
    genre: meta.genre,
    dimension: meta.dimension,
    difficulty: meta.difficulty,
    gameJSON: validatedJSON,
    htmlString,
    thumbnailUrl: data.thumbnailUrl,
    assetManifest,
    prompt: data.prompt,
    mcqAnswers: data.mcqAnswers,
    userId: req.user.id,
    isPublished: data.isPublished
  });

  analytics.logEvent({
    eventType: EVENT_TYPES.GAME_CREATED,
    gameId: created.id,
    userId: req.user.id,
    metadata: { genre: meta.genre, dimension: meta.dimension }
  });

  res.status(201).json(created);
});

router.get('/:id', requireAuth, validate(idParamSchema, 'params'), (req, res) => {
  const game = games.getGame(req.params.id);
  assertCanAccess(req, game);
  res.json(game);
});

router.put('/:id',
  requireAuth,
  validate(idParamSchema, 'params'),
  validate(gameUpdateSchema),
  (req, res) => {
    const existing = games.getGame(req.params.id);
    assertCanAccess(req, existing);

    const patch = { ...req.body };
    if (patch.gameJSON) {
      patch.gameJSON = validateGameJSONStrict(patch.gameJSON);
      patch.genre = patch.gameJSON.metadata.genre;
      patch.dimension = patch.gameJSON.metadata.dimension;
      patch.difficulty = patch.gameJSON.metadata.difficulty;
      patch.htmlString = patch.htmlString || buildGameHTML(patch.gameJSON);
      patch.assetManifest = patch.assetManifest || buildAssetManifest(patch.gameJSON);
    }

    const updated = games.updateGame(req.params.id, patch);

    analytics.logEvent({
      eventType: EVENT_TYPES.GAME_EDITED,
      gameId: updated.id,
      userId: req.user.id,
      metadata: { fields: Object.keys(req.body) }
    });

    res.json(updated);
  }
);

router.delete('/:id', requireAuth, validate(idParamSchema, 'params'), (req, res) => {
  const existing = games.getGame(req.params.id);
  assertCanAccess(req, existing);
  const deleted = games.deleteGame(req.params.id);
  if (!deleted) throw new NotFoundError('Game');

  analytics.logEvent({
    eventType: EVENT_TYPES.GAME_DELETED,
    gameId: req.params.id,
    userId: req.user.id
  });

  res.json({ success: true, id: req.params.id });
});

router.get('/:id/assets', requireAuth, validate(idParamSchema, 'params'), (req, res) => {
  const game = games.getGame(req.params.id);
  assertCanAccess(req, game);
  res.json({ gameId: game.id, assets: game.assetManifest || [] });
});

router.get('/:id/download', requireAuth, validate(idParamSchema, 'params'), (req, res) => {
  const game = games.getGame(req.params.id);
  assertCanAccess(req, game);
  analytics.logEvent({
    eventType: EVENT_TYPES.GAME_DOWNLOADED,
    gameId: game.id,
    userId: req.user.id
  });
  streamGameZip({ game, res });
});

module.exports = router;
