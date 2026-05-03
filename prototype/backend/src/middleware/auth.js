/* ============================================================================
   Authentication / Authorization Middleware
   ========================================================================= */

const authService = require('../services/authService');
const { AuthenticationError, AuthorizationError } = require('../utils/errors');
const { USER_ROLES } = require('../config/constants');

function readBearerToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
}

function optionalAuth(req, _res, next) {
  try {
    const token = readBearerToken(req);
    if (token) req.user = authService.getUserFromToken(token);
    next();
  } catch (err) {
    next(err);
  }
}

function requireAuth(req, _res, next) {
  try {
    const token = readBearerToken(req);
    if (!token) throw new AuthenticationError();
    req.user = authService.getUserFromToken(token);
    next();
  } catch (err) {
    next(err);
  }
}

function requireAdmin(req, _res, next) {
  if (!req.user) return next(new AuthenticationError());
  if (req.user.role !== USER_ROLES.ADMIN) {
    return next(new AuthorizationError('Admin access required'));
  }
  next();
}

function ensureSelfOrAdmin(req, ownerUserId) {
  if (!req.user) throw new AuthenticationError();
  if (req.user.role === USER_ROLES.ADMIN) return;
  if (req.user.id !== ownerUserId) {
    throw new AuthorizationError();
  }
}

module.exports = { optionalAuth, requireAuth, requireAdmin, ensureSelfOrAdmin };
