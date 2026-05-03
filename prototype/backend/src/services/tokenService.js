/* ============================================================================
   Token/Credit Service
   ========================================================================= */

const { getDb } = require('../db/connection');
const users = require('../db/users');
const analytics = require('../db/analytics');
const config = require('../config/env');
const { EVENT_TYPES } = require('../config/constants');
const { PaymentRequiredError, NotFoundError } = require('../utils/errors');

const DEV_TEST_TOKENS = 9000;

function ensureTestTokens(userId) {
  return users.ensureMinimumTokens({ userId, amount: DEV_TEST_TOKENS });
}

function getBalance(userId) {
  const user = (!config.auth.tokenEnforcementEnabled && config.isDev)
    ? ensureTestTokens(userId)
    : users.getUserById(userId);
  if (!user) throw new NotFoundError('User');
  return {
    userId,
    tokensRemaining: user.tokenBalance,
    tokensTotal: user.totalTokens,
    subscription: user.subscriptionTier
  };
}

function spend({ userId, gameId = null, amount, actionType, metadata = null }) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('Token amount must be a positive integer');
  }

  if (!config.auth.tokenEnforcementEnabled) {
    if (!config.isDev) {
      throw new Error('Token enforcement can only be disabled in development');
    }
    return ensureTestTokens(userId);
  }

  const db = getDb();
  const tx = db.transaction(() => {
    const user = users.getUserById(userId);
    if (!user) throw new NotFoundError('User');
    if (user.tokenBalance < amount) {
      throw new PaymentRequiredError('Not enough tokens for this action', {
        required: amount,
        available: user.tokenBalance
      });
    }

    const updated = users.adjustTokenBalance({ userId, delta: -amount });
    analytics.recordTokenSpend({
      userId,
      gameId,
      tokensSpent: amount,
      actionType,
      balanceAfter: updated.tokenBalance,
      metadata
    });
    analytics.logEvent({
      eventType: EVENT_TYPES.TOKENS_SPENT,
      userId,
      gameId,
      metadata: { actionType, amount, balanceAfter: updated.tokenBalance }
    });
    return updated;
  });

  return tx();
}

function grant({ userId, amount }) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('Grant amount must be a positive integer');
  }
  return users.adjustTokenBalance({ userId, delta: amount });
}

module.exports = { getBalance, spend, grant, ensureTestTokens, DEV_TEST_TOKENS };
