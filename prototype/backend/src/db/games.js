/* ============================================================================
   Games Repository
   ========================================================================= */

const crypto = require('crypto');
const { getDb } = require('./connection');
const { NotFoundError } = require('../utils/errors');

function generateId() {
  return 'game_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
}

function parseJSON(value, fallback = null) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function rowToGame(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    genre: row.genre,
    dimension: row.dimension,
    difficulty: row.difficulty,
    gameJSON: parseJSON(row.game_json),
    htmlString: row.html_string,
    thumbnailUrl: row.thumbnail_url,
    assetManifest: parseJSON(row.asset_manifest, []),
    prompt: row.prompt,
    mcqAnswers: parseJSON(row.mcq_answers),
    userId: row.user_id,
    isPublished: !!row.is_published,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at
  };
}

function createGame(data) {
  const db = getDb();
  const id = data.id || generateId();

  db.prepare(`
    INSERT INTO games (
      id, title, description, genre, dimension, difficulty, game_json,
      html_string, thumbnail_url, asset_manifest, prompt, mcq_answers, user_id, is_published
    )
    VALUES (
      @id, @title, @description, @genre, @dimension, @difficulty, @game_json,
      @html_string, @thumbnail_url, @asset_manifest, @prompt, @mcq_answers, @user_id, @is_published
    )
  `).run({
    id,
    title: data.title,
    description: data.description || null,
    genre: data.genre,
    dimension: data.dimension,
    difficulty: data.difficulty || null,
    game_json: typeof data.gameJSON === 'string' ? data.gameJSON : JSON.stringify(data.gameJSON),
    html_string: data.htmlString || null,
    thumbnail_url: data.thumbnailUrl || null,
    asset_manifest: data.assetManifest ? JSON.stringify(data.assetManifest) : null,
    prompt: data.prompt || null,
    mcq_answers: data.mcqAnswers ? JSON.stringify(data.mcqAnswers) : null,
    user_id: data.userId || null,
    is_published: data.isPublished ? 1 : 0
  });

  return getGame(id);
}

function getGame(id, { includeDeleted = false } = {}) {
  const sql = includeDeleted
    ? 'SELECT * FROM games WHERE id = ?'
    : 'SELECT * FROM games WHERE id = ? AND deleted_at IS NULL';
  return rowToGame(getDb().prepare(sql).get(id));
}

function getAllGames(options = {}) {
  const db = getDb();
  const limit = Math.min(options.limit || 100, 500);
  const offset = options.offset || 0;
  const orderBy = ['updated_at', 'created_at', 'title'].includes(options.orderBy)
    ? options.orderBy
    : 'updated_at';

  let sql = 'SELECT * FROM games WHERE deleted_at IS NULL';
  const params = [];

  if (options.userId) {
    sql += ' AND user_id = ?';
    params.push(options.userId);
  }

  sql += ` ORDER BY ${orderBy} DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  return db.prepare(sql).all(...params).map(rowToGame);
}

function updateGame(id, data) {
  const existing = getGame(id);
  if (!existing) throw new NotFoundError('Game');

  const fields = [];
  const params = { id };

  if (data.title != null) { fields.push('title = @title'); params.title = data.title; }
  if (data.description != null) { fields.push('description = @description'); params.description = data.description; }
  if (data.genre != null) { fields.push('genre = @genre'); params.genre = data.genre; }
  if (data.dimension != null) { fields.push('dimension = @dimension'); params.dimension = data.dimension; }
  if (data.difficulty != null) { fields.push('difficulty = @difficulty'); params.difficulty = data.difficulty; }
  if (data.gameJSON != null) {
    fields.push('game_json = @game_json');
    params.game_json = typeof data.gameJSON === 'string' ? data.gameJSON : JSON.stringify(data.gameJSON);
  }
  if (data.htmlString != null) { fields.push('html_string = @html_string'); params.html_string = data.htmlString; }
  if (data.thumbnailUrl != null) { fields.push('thumbnail_url = @thumbnail_url'); params.thumbnail_url = data.thumbnailUrl; }
  if (data.assetManifest != null) {
    fields.push('asset_manifest = @asset_manifest');
    params.asset_manifest = JSON.stringify(data.assetManifest);
  }
  if (data.prompt != null) { fields.push('prompt = @prompt'); params.prompt = data.prompt; }
  if (data.mcqAnswers != null) { fields.push('mcq_answers = @mcq_answers'); params.mcq_answers = JSON.stringify(data.mcqAnswers); }
  if (data.userId != null) { fields.push('user_id = @user_id'); params.user_id = data.userId; }
  if (data.isPublished != null) { fields.push('is_published = @is_published'); params.is_published = data.isPublished ? 1 : 0; }

  if (fields.length === 0) return existing;

  getDb().prepare(`UPDATE games SET ${fields.join(', ')} WHERE id = @id`).run(params);
  return getGame(id);
}

function deleteGame(id) {
  const result = getDb().prepare(`
    UPDATE games SET deleted_at = datetime('now'), is_published = 0
    WHERE id = ? AND deleted_at IS NULL
  `).run(id);
  return result.changes > 0;
}

function hardDeleteGame(id) {
  const result = getDb().prepare('DELETE FROM games WHERE id = ?').run(id);
  return result.changes > 0;
}

function countGames(userId = null) {
  const db = getDb();
  if (userId) {
    return db.prepare('SELECT COUNT(*) as c FROM games WHERE user_id = ? AND deleted_at IS NULL').get(userId).c;
  }
  return db.prepare('SELECT COUNT(*) as c FROM games WHERE deleted_at IS NULL').get().c;
}

module.exports = {
  generateId,
  createGame,
  getGame,
  getAllGames,
  updateGame,
  deleteGame,
  hardDeleteGame,
  countGames
};
