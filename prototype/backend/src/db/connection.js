/* ============================================================================
   SQLite Connection
   ----------------------------------------------------------------------------
   Uses better-sqlite3 (synchronous, fast, simple).
   Initializes schema on startup.
   ========================================================================= */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('../config/env');
const logger = require('../utils/logger');
const { runMigrations } = require('./migrations');

let db = null;

function init() {
  if (db) return db;

  // Ensure data directory exists
  const dir = config.database.path === ':memory:' ? null : path.dirname(config.database.path);
  if (dir && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    logger.info({ dir }, 'Created database directory');
  }

  // Open DB
  db = new Database(config.database.path, {
    fileMustExist: false,
    verbose: config.isDev ? null : null  // pass logger.debug.bind(logger) to debug queries
  });

  // PRAGMAs for performance & safety
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  // Run schema
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);
  runMigrations(db);

  logger.info({ path: config.database.path }, '🗄️  Database initialized');

  return db;
}

function getDb() {
  if (!db) init();
  return db;
}

function close() {
  if (db) {
    db.close();
    db = null;
    logger.info('Database connection closed');
  }
}

function healthCheck() {
  try {
    const result = getDb().prepare('SELECT 1 as ok').get();
    return result.ok === 1;
  } catch (err) {
    logger.error({ err }, 'Database health check failed');
    return false;
  }
}

module.exports = { init, getDb, close, healthCheck };
