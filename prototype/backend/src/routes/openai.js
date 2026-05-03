/* ============================================================================
   Admin-only Generic AI Route
   ----------------------------------------------------------------------------
   Product flows should use /api/mcq/generate and /api/generate-game instead.
   ========================================================================= */

const express = require('express');
const validate = require('../middleware/validate');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { openaiRequestSchema } = require('../schemas/apiSchemas');
const { generateJSON, generateText } = require('../services/openaiService');
const tokenService = require('../services/tokenService');
const analytics = require('../db/analytics');
const config = require('../config/env');
const { EVENT_TYPES, TOKEN_COSTS } = require('../config/constants');
const { ServiceUnavailableError } = require('../utils/errors');
const logger = require('../utils/logger');

const router = express.Router();

router.post('/', requireAuth, requireAdmin, validate(openaiRequestSchema), async (req, res, next) => {
  const { prompt, systemPrompt, model, format } = req.body;

  try {
    if (!config.ai.genericEndpointEnabled) {
      throw new ServiceUnavailableError('Generic AI endpoint', 'Generic AI endpoint is disabled. Use product-specific AI endpoints.');
    }

    tokenService.spend({
      userId: req.user.id,
      amount: TOKEN_COSTS.PROMPT_QUERY,
      actionType: 'query',
      metadata: { source: 'generic-ai', provider: config.ai.provider, format }
    });

    if (format === 'text') {
      const result = await generateText({ prompt, systemPrompt, model, generationConfig: { maxOutputTokens: 4000 } });
      analytics.logEvent({
        eventType: EVENT_TYPES.OPENAI_CALLED,
        userId: req.user.id,
        generationTimeMs: result.durationMs,
        metadata: { format: 'text', model: result.model }
      });
      return res.json({ text: result.text, model: result.model, durationMs: result.durationMs });
    }

    const result = await generateJSON({ prompt, systemPrompt, model, generationConfig: { maxOutputTokens: 12000 } });
    analytics.logEvent({
      eventType: EVENT_TYPES.OPENAI_CALLED,
      userId: req.user.id,
      generationTimeMs: result.durationMs,
      metadata: { format: 'json', model: result.model }
    });

    res.setHeader('X-AI-Provider', config.ai.provider);
    res.setHeader('X-AI-Model', result.model);
    res.setHeader('X-AI-Duration-Ms', result.durationMs);
    return res.json(result.json);
  } catch (err) {
    logger.warn({ requestId: req.id, err: err.message }, 'Generic AI route failed');
    next(err);
  }
});

module.exports = router;
