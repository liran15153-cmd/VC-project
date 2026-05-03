/* ============================================================================
   404 Handler — last middleware before errorHandler
   ========================================================================= */

const { NotFoundError } = require('../utils/errors');

function notFoundHandler(req, _res, next) {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl}`));
}

module.exports = notFoundHandler;
