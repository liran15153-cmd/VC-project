/* ============================================================================
   Rate Limiters
   ----------------------------------------------------------------------------
   Three tiers as per project spec:
     - generation:  /api/generate-game, /api/edit-game (expensive AI calls)
     - openai:      /api/ai, /api/openai and AI helper routes (medium cost)
     - default:     everything else (cheap reads/writes)
   Returns clear 429 errors with retry-after info.
   ========================================================================= */

const rateLimit = require('express-rate-limit');
const config = require('../config/env');

function makeLimiter({ max, windowMs = 60_000, label }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      error: `Too many requests on ${label}. Limit: ${max}/${windowMs / 1000}s`,
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil(windowMs / 1000),
      label
    },
    keyGenerator: (req) => req.ip,
    handler: (req, res, _next, options) => {
      res.status(options.statusCode).json(options.message);
    }
  });
}

module.exports = {
  generation: makeLimiter({
    max: config.rateLimits.generation,
    label: 'AI generation'
  }),
  openai: makeLimiter({
    max: config.rateLimits.openai,
    label: 'AI provider API'
  }),
  default: makeLimiter({
    max: config.rateLimits.default,
    label: 'general API'
  })
};
