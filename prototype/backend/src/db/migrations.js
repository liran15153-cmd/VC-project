/* ============================================================================
   Idempotent SQLite Migrations
   ========================================================================= */

const logger = require('../utils/logger');

function columnExists(db, table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((row) => row.name === column);
}

function ensureColumn(db, table, column, definition) {
  if (columnExists(db, table, column)) return;
  db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  logger.info({ table, column }, 'Added database column');
}

function runMigrations(db) {
  ensureColumn(db, 'games', 'html_string', 'TEXT');
  ensureColumn(db, 'games', 'thumbnail_url', 'TEXT');
  ensureColumn(db, 'games', 'asset_manifest', 'TEXT');
  ensureColumn(db, 'games', 'deleted_at', 'TEXT');

  ensureColumn(db, 'token_usage', 'balance_after', 'INTEGER');
  ensureColumn(db, 'token_usage', 'metadata', 'TEXT');

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_games_deleted ON games(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_token_game ON token_usage(game_id);
  `);
}

module.exports = { runMigrations };
