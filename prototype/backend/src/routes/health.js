/* ============================================================================
   Health Check Route — GET /api/health
   ----------------------------------------------------------------------------
   Deep check: server is up + DB is reachable + AI provider configured.
   Returns 503 if anything critical is down.
   ========================================================================= */

const express = require('express');
const config = require('../config/env');
const { healthCheck: dbHealthCheck } = require('../db/connection');

const router = express.Router();
const startedAt = Date.now();

router.get('/', (_req, res) => {
  const dbOk = dbHealthCheck();
  const aiConfigured = config.ai.enabled;

  const status = dbOk ? 'ok' : 'degraded';
  const httpStatus = dbOk ? 200 : 503;

  res.status(httpStatus).json({
    status,
    version: '0.2.0',
    env: config.env,
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
    services: {
      database: dbOk ? 'ok' : 'down',
      ai: aiConfigured ? 'configured' : 'not_configured',
      openai: config.openai.enabled ? 'configured' : 'not_configured',
      openrouter: config.openrouter.enabled ? 'configured' : 'not_configured'
    },
    ai: {
      provider: config.ai.provider,
      providerLabel: config.ai.providerLabel,
      configured: aiConfigured,
      defaultModel: config.ai.defaultModel,
      supportedModels: config.ai.supportedModels
    }
  });
});

module.exports = router;
