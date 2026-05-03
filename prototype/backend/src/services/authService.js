/* ============================================================================
   Auth Service
   ========================================================================= */

const crypto = require('crypto');
const config = require('../config/env');
const users = require('../db/users');
const analytics = require('../db/analytics');
const { EVENT_TYPES, USER_ROLES, SUBSCRIPTION_TIERS } = require('../config/constants');
const { AuthenticationError } = require('../utils/errors');

const DEV_TEST_TOKEN_BALANCE = 9000;

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(input) {
  return crypto.createHmac('sha256', config.auth.tokenSecret).update(input).digest('base64url');
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
  const [scheme, salt, expectedHex] = String(stored || '').split('$');
  if (scheme !== 'scrypt' || !salt || !expectedHex) return false;
  const actual = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(actual, expected);
}

function createToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    iat: now,
    exp: now + config.auth.tokenTtlSeconds
  };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  return `${encodedHeader}.${encodedPayload}.${sign(`${encodedHeader}.${encodedPayload}`)}`;
}

function verifyToken(token) {
  const [encodedHeader, encodedPayload, signature] = String(token || '').split('.');
  if (!encodedHeader || !encodedPayload || !signature) {
    throw new AuthenticationError('Invalid auth token');
  }

  const expected = sign(`${encodedHeader}.${encodedPayload}`);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) {
    throw new AuthenticationError('Invalid auth token');
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf-8'));
  } catch {
    throw new AuthenticationError('Invalid auth token');
  }

  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new AuthenticationError('Auth token expired');
  }
  return payload;
}

function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

function chooseRole(email) {
  const lower = email.toLowerCase();
  if (config.auth.adminEmails.includes(lower)) return USER_ROLES.ADMIN;
  if (config.auth.autoAdminFirstUser && users.countUsers() === 0) return USER_ROLES.ADMIN;
  return USER_ROLES.USER;
}

function register({ email, password, displayName }) {
  const role = chooseRole(email);
  const tokenBalance = config.auth.tokenEnforcementEnabled
    ? config.auth.defaultFreeTokens
    : DEV_TEST_TOKEN_BALANCE;
  const user = users.createUser({
    email,
    displayName,
    passwordHash: hashPassword(password),
    role,
    subscriptionTier: SUBSCRIPTION_TIERS.FREE,
    tokenBalance,
    totalTokens: tokenBalance
  });
  analytics.logEvent({
    eventType: EVENT_TYPES.USER_REGISTERED,
    userId: user.id,
    metadata: { role, subscriptionTier: user.subscriptionTier }
  });
  return { user: sanitizeUser(user), token: createToken(user) };
}

function login({ email, password }) {
  const user = users.getUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new AuthenticationError('Invalid email or password');
  }
  if (!config.auth.tokenEnforcementEnabled && config.isDev) {
    users.ensureMinimumTokens({ userId: user.id, amount: DEV_TEST_TOKEN_BALANCE });
  }
  const touched = users.touchLogin(user.id);
  analytics.logEvent({ eventType: EVENT_TYPES.USER_LOGGED_IN, userId: user.id });
  return { user: sanitizeUser(touched), token: createToken(touched) };
}

function getUserFromToken(token) {
  const payload = verifyToken(token);
  const user = users.getUserById(payload.sub);
  if (!user) throw new AuthenticationError('User no longer exists');
  return user;
}

module.exports = {
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
  register,
  login,
  getUserFromToken,
  sanitizeUser
};
