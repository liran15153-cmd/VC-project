/* ============================================================================
   Analytics & Token Usage Repository
   ----------------------------------------------------------------------------
   Tracks all events for monitoring and improvement (Claude.md requirement).
   ========================================================================= */

const { getDb } = require('./connection');

// =================================================================
// ANALYTICS
// =================================================================

function logEvent(event) {
  const db = getDb();
  db.prepare(`
    INSERT INTO analytics (user_id, game_id, event_type, generation_time_ms, error_message, metadata)
    VALUES (@userId, @gameId, @eventType, @generationTimeMs, @errorMessage, @metadata)
  `).run({
    userId: event.userId || null,
    gameId: event.gameId || null,
    eventType: event.eventType,
    generationTimeMs: event.generationTimeMs || null,
    errorMessage: event.errorMessage || null,
    metadata: event.metadata ? JSON.stringify(event.metadata) : null
  });
}

function getEventCounts(since = null) {
  const db = getDb();
  const sinceClause = since ? "WHERE created_at >= ?" : "";
  const sql = `
    SELECT event_type, COUNT(*) as count
    FROM analytics
    ${sinceClause}
    GROUP BY event_type
    ORDER BY count DESC
  `;
  return since
    ? db.prepare(sql).all(since)
    : db.prepare(sql).all();
}

function getAvgGenerationTime() {
  const db = getDb();
  const row = db.prepare(`
    SELECT AVG(generation_time_ms) as avg_ms, COUNT(*) as count
    FROM analytics
    WHERE event_type = 'generation_succeeded' AND generation_time_ms IS NOT NULL
  `).get();
  return {
    avgMs: row.avg_ms ? Math.round(row.avg_ms) : null,
    sampleSize: row.count
  };
}

function getRecentEvents(limit = 50) {
  const db = getDb();
  return db.prepare(`
    SELECT id, user_id, game_id, event_type, generation_time_ms, error_message, metadata, created_at
    FROM analytics
    ORDER BY created_at DESC
    LIMIT ?
  `).all(Math.min(limit, 200));
}

// =================================================================
// TOKEN USAGE
// =================================================================

function recordTokenSpend({ userId = null, gameId = null, tokensSpent, actionType, balanceAfter = null, metadata = null }) {
  const db = getDb();
  db.prepare(`
    INSERT INTO token_usage (user_id, game_id, tokens_spent, action_type, balance_after, metadata)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    gameId,
    tokensSpent,
    actionType,
    balanceAfter,
    metadata ? JSON.stringify(metadata) : null
  );
}

function getTotalTokenSpend(userId = null) {
  const db = getDb();
  if (userId) {
    return db.prepare(`SELECT COALESCE(SUM(tokens_spent), 0) as total FROM token_usage WHERE user_id = ?`).get(userId).total;
  }
  return db.prepare(`SELECT COALESCE(SUM(tokens_spent), 0) as total FROM token_usage`).get().total;
}

// =================================================================
// PROMPTS HISTORY
// =================================================================

function logPrompt(data) {
  const db = getDb();
  db.prepare(`
    INSERT INTO prompts_history (game_id, user_id, prompt, prompt_type, mcq_questions, mcq_answers, model_used, tokens_used)
    VALUES (@gameId, @userId, @prompt, @promptType, @mcqQuestions, @mcqAnswers, @modelUsed, @tokensUsed)
  `).run({
    gameId: data.gameId || null,
    userId: data.userId || null,
    prompt: data.prompt,
    promptType: data.promptType,
    mcqQuestions: data.mcqQuestions ? JSON.stringify(data.mcqQuestions) : null,
    mcqAnswers: data.mcqAnswers ? JSON.stringify(data.mcqAnswers) : null,
    modelUsed: data.modelUsed || null,
    tokensUsed: data.tokensUsed || null
  });
}

// =================================================================
// AGGREGATED STATS
// =================================================================

function getStats() {
  const db = getDb();
  return {
    games: {
      total: db.prepare('SELECT COUNT(*) as c FROM games WHERE deleted_at IS NULL').get().c,
      published: db.prepare('SELECT COUNT(*) as c FROM games WHERE is_published = 1 AND deleted_at IS NULL').get().c,
      byGenre: db.prepare('SELECT genre, COUNT(*) as count FROM games WHERE deleted_at IS NULL GROUP BY genre ORDER BY count DESC').all(),
      byDimension: db.prepare('SELECT dimension, COUNT(*) as count FROM games WHERE deleted_at IS NULL GROUP BY dimension').all()
    },
    users: {
      total: db.prepare('SELECT COUNT(*) as c FROM users WHERE deleted_at IS NULL').get().c,
      byRole: db.prepare('SELECT role, COUNT(*) as count FROM users WHERE deleted_at IS NULL GROUP BY role').all(),
      tokensRemaining: db.prepare('SELECT COALESCE(SUM(token_balance), 0) as total FROM users WHERE deleted_at IS NULL').get().total
    },
    generation: getAvgGenerationTime(),
    events: getEventCounts(),
    tokens: {
      totalSpent: getTotalTokenSpend(),
      byAction: db.prepare(`
        SELECT action_type, SUM(tokens_spent) as total, COUNT(*) as count
        FROM token_usage
        GROUP BY action_type
      `).all()
    },
    prompts: {
      total: db.prepare('SELECT COUNT(*) as c FROM prompts_history').get().c,
      byType: db.prepare(`SELECT prompt_type, COUNT(*) as count FROM prompts_history GROUP BY prompt_type`).all()
    }
  };
}

module.exports = {
  logEvent,
  getEventCounts,
  getAvgGenerationTime,
  getRecentEvents,
  recordTokenSpend,
  getTotalTokenSpend,
  logPrompt,
  getStats
};
