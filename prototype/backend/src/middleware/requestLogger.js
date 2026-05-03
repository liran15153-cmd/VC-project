/* ============================================================================
   Request Logger Middleware
   ----------------------------------------------------------------------------
   Two pieces:
     1. requestId: assigns a unique ID to every request (header X-Request-Id)
     2. pinoHttp: structured access log with method, URL, status, duration
   ========================================================================= */

const crypto = require('crypto');
const pinoHttp = require('pino-http');
const logger = require('../utils/logger');
const { HEADERS } = require('../config/constants');

function requestId(req, res, next) {
  const id = req.headers[HEADERS.REQUEST_ID] || crypto.randomBytes(8).toString('hex');
  req.id = id;
  res.setHeader(HEADERS.REQUEST_ID, id);
  next();
}

const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => req.id,
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      remoteAddress: req.remoteAddress
    }),
    res: (res) => ({ statusCode: res.statusCode })
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res, responseTime) =>
    `${req.method} ${req.url} → ${res.statusCode} (${responseTime}ms)`,
  customErrorMessage: (req, res, err) =>
    `${req.method} ${req.url} → ${res.statusCode} ${err?.message || ''}`
});

module.exports = { requestId, httpLogger };
