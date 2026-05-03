-- ============================================================================
-- Gaming Vibe Coding - Database Schema
-- SQLite via better-sqlite3
-- ============================================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ============================================================================
-- users
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id                 TEXT PRIMARY KEY,
  email              TEXT NOT NULL UNIQUE,
  password_hash      TEXT NOT NULL,
  display_name       TEXT,
  role               TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  subscription_tier  TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
  token_balance      INTEGER NOT NULL DEFAULT 0 CHECK (token_balance >= 0),
  total_tokens       INTEGER NOT NULL DEFAULT 0 CHECK (total_tokens >= 0),
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at      TEXT,
  deleted_at         TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE TRIGGER IF NOT EXISTS users_updated_at
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
  UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ============================================================================
-- games
-- ============================================================================
CREATE TABLE IF NOT EXISTS games (
  id             TEXT PRIMARY KEY,
  title          TEXT NOT NULL,
  description    TEXT,
  genre          TEXT NOT NULL,
  dimension      TEXT NOT NULL CHECK (dimension IN ('2D', '3D')),
  difficulty     TEXT,
  game_json      TEXT NOT NULL,
  html_string    TEXT,
  thumbnail_url  TEXT,
  asset_manifest TEXT,
  prompt         TEXT,
  mcq_answers    TEXT,
  user_id        TEXT,
  is_published   INTEGER DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at     TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_games_user_id ON games(user_id);
CREATE INDEX IF NOT EXISTS idx_games_genre ON games(genre);
CREATE INDEX IF NOT EXISTS idx_games_updated ON games(updated_at DESC);

CREATE TRIGGER IF NOT EXISTS games_updated_at
AFTER UPDATE ON games
FOR EACH ROW
BEGIN
  UPDATE games SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ============================================================================
-- token_usage
-- ============================================================================
CREATE TABLE IF NOT EXISTS token_usage (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       TEXT,
  game_id       TEXT,
  tokens_spent  INTEGER NOT NULL,
  action_type   TEXT NOT NULL CHECK (action_type IN ('create', 'edit', 'query')),
  balance_after INTEGER,
  metadata      TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_token_user ON token_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_token_game ON token_usage(game_id);
CREATE INDEX IF NOT EXISTS idx_token_action ON token_usage(action_type);

-- ============================================================================
-- prompts_history
-- ============================================================================
CREATE TABLE IF NOT EXISTS prompts_history (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id         TEXT,
  user_id         TEXT,
  prompt          TEXT NOT NULL,
  prompt_type     TEXT NOT NULL CHECK (prompt_type IN ('mcq', 'generate', 'edit', 'query')),
  mcq_questions   TEXT,
  mcq_answers     TEXT,
  model_used      TEXT,
  tokens_used     INTEGER,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_prompts_game ON prompts_history(game_id);
CREATE INDEX IF NOT EXISTS idx_prompts_user ON prompts_history(user_id);
CREATE INDEX IF NOT EXISTS idx_prompts_type ON prompts_history(prompt_type);
CREATE INDEX IF NOT EXISTS idx_prompts_created ON prompts_history(created_at DESC);

-- ============================================================================
-- analytics
-- ============================================================================
CREATE TABLE IF NOT EXISTS analytics (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id            TEXT,
  game_id            TEXT,
  event_type         TEXT NOT NULL,
  generation_time_ms INTEGER,
  error_message      TEXT,
  metadata           TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_analytics_event ON analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_user ON analytics(user_id);
