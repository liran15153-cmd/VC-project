/* ============================================================================
   Global Error Handler
   ----------------------------------------------------------------------------
   Catches every error thrown/passed to next() and returns a consistent
   JSON shape: { error, code, details?, requestId? }
   Logs with full context. Hides stack traces from clients in production.
   ========================================================================= */

const { AppError } = require('../utils/errors');
const logger = require('../utils/logger');
const config = require('../config/env');

function errorHandler(err, req, res, _next) {
  const isAppError = err instanceof AppError;

  const statusCode = isAppError ? err.statusCode : 500;
  const code = isAppError ? err.code : 'INTERNAL_ERROR';
  const message = isAppError ? err.message : 'Internal server error';
  const details = isAppError ? err.details : undefined;

  // Log everything (with stack in dev, without in prod for non-app errors)
  const logContext = {
    requestId: req.id,
    method: req.method,
    url: req.originalUrl,
    statusCode,
    code,
    err: { message: err.message, stack: config.isDev ? err.stack : undefined }
  };

  if (statusCode >= 500) {
    logger.error(logContext, '🔥 Unhandled error');
  } else if (statusCode >= 400) {
    logger.warn(logContext, '⚠️  Client error');
  }

  // Build response
  const response = {
    error: message,
    code,
    requestId: req.id
  };
  if (details) response.details = details;
  if (config.isDev && !isAppError) response.stack = err.stack;

  res.status(statusCode).json(response);
}

module.exports = errorHandler;
