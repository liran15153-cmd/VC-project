/* ============================================================================
   Users Repository
   ========================================================================= */

const crypto = require('crypto');
const { getDb } = require('./connection');
const { ConflictError, NotFoundError } = require('../utils/errors');

function generateUserId() {
  return 'usr_' + crypto.randomBytes(12).toString('hex');
}

function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    subscriptionTier: row.subscription_tier,
    tokenBalance: row.token_balance,
    totalTokens: row.total_tokens,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at,
    deletedAt: row.deleted_at
  };
}

function rowToUserWithPassword(row) {
  if (!row) return null;
  return { ...rowToUser(row), passwordHash: row.password_hash };
}

function countUsers() {
  return getDb().prepare('SELECT COUNT(*) as c FROM users WHERE deleted_at IS NULL').get().c;
}

function createUser(data) {
  const db = getDb();
  const id = data.id || generateUserId();
  try {
    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, role, subscription_tier, token_balance, total_tokens)
      VALUES (@id, @email, @passwordHash, @displayName, @role, @subscriptionTier, @tokenBalance, @totalTokens)
    `).run({
      id,
      email: data.email.toLowerCase(),
      passwordHash: data.passwordHash,
      displayName: data.displayName || null,
      role: data.role || 'user',
      subscriptionTier: data.subscriptionTier || 'free',
      tokenBalance: data.tokenBalance || 0,
      totalTokens: data.totalTokens || data.tokenBalance || 0
    });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      throw new ConflictError('A user with this email already exists');
    }
    throw err;
  }
  return getUserById(id);
}

function getUserById(id, { includeDeleted = false } = {}) {
  const sql = includeDeleted
    ? 'SELECT * FROM users WHERE id = ?'
    : 'SELECT * FROM users WHERE id = ? AND deleted_at IS NULL';
  return rowToUser(getDb().prepare(sql).get(id));
}

function getUserByEmail(email) {
  return rowToUserWithPassword(
    getDb().prepare('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL').get(email.toLowerCase())
  );
}

function touchLogin(id) {
  getDb().prepare(`UPDATE users SET last_login_at = datetime('now') WHERE id = ?`).run(id);
  return getUserById(id);
}

function adjustTokenBalance({ userId, delta }) {
  const db = getDb();
  const result = db.prepare(`
    UPDATE users
    SET token_balance = token_balance + @delta,
        total_tokens = CASE WHEN @delta > 0 THEN total_tokens + @delta ELSE total_tokens END
    WHERE id = @userId
      AND deleted_at IS NULL
      AND token_balance + @delta >= 0
  `).run({ userId, delta });

  if (result.changes === 0) {
    const user = getUserById(userId);
    if (!user) throw new NotFoundError('User');
    return null;
  }
  return getUserById(userId);
}

function ensureMinimumTokens({ userId, amount }) {
  const db = getDb();
  const result = db.prepare(`
    UPDATE users
    SET token_balance = CASE WHEN token_balance < @amount THEN @amount ELSE token_balance END,
        total_tokens = CASE WHEN total_tokens < @amount THEN @amount ELSE total_tokens END
    WHERE id = @userId
      AND deleted_at IS NULL
  `).run({ userId, amount });

  if (result.changes === 0) throw new NotFoundError('User');
  return getUserById(userId);
}

function setRole(id, role) {
  const result = getDb().prepare(`UPDATE users SET role = ? WHERE id = ? AND deleted_at IS NULL`).run(role, id);
  if (result.changes === 0) throw new NotFoundError('User');
  return getUserById(id);
}

module.exports = {
  generateUserId,
  createUser,
  getUserById,
  getUserByEmail,
  countUsers,
  touchLogin,
  adjustTokenBalance,
  ensureMinimumTokens,
  setRole
};
