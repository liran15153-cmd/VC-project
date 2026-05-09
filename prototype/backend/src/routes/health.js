/* ============================================================================
   Health Check Route - GET /api/health
   ----------------------------------------------------------------------------
   Stateless check: server is up and reports AI/provider configuration.
   ========================================================================= */

const express = require('express');
const config = require('../config/env');

const router = express.Router();
const startedAt = Date.now();

router.get('/', (_req, res) => {
  const aiConfigured = config.ai.enabled;

  res.json({
    status: 'ok',
    version: '0.2.0',
    env: config.env,
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
    services: {
      database: 'supabase_pending',
      auth: 'supabase_pending',
      storage: 'supabase_pending',
      ai: aiConfigured ? 'configured' : 'not_configured',
      openai: config.openai.enabled ? 'configured' : 'not_configured',
      openrouter: config.openrouter.enabled ? 'configured' : 'not_configured'
    },
    ai: {
      mode: config.ai.mode,
      provider: config.ai.provider,
      providerLabel: config.ai.providerLabel,
      configured: aiConfigured,
      defaultModel: config.ai.defaultModel,
      supportedModels: config.ai.supportedModels
    }
  });
});

module.exports = router;
