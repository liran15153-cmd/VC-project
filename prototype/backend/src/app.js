/* ============================================================================
   Express App
   ----------------------------------------------------------------------------
   Builds and configures the app — does not start it.
   server.js handles the actual listen() and shutdown.
   ========================================================================= */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

const config = require('./config/env');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const notFoundHandler = require('./middleware/notFoundHandler');
const { requestId, httpLogger } = require('./middleware/requestLogger');

function createApp() {
  const app = express();

  // Trust first proxy (e.g. nginx) — needed for correct req.ip with rate limiter
  if (config.trustProxy) app.set('trust proxy', 1);

  // Security
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  }));

  // CORS — frontend may run on file://, localhost:5173, or wherever
  app.use(cors({
    origin: config.cors.origins,
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'X-Response-Time', 'X-AI-Provider', 'X-AI-Model', 'X-AI-Duration-Ms']
  }));

  // Compression for JSON responses
  app.use(compression());

  // Body parser with size limit
  app.use(express.json({ limit: config.bodyLimit }));
  app.use(express.urlencoded({ extended: false, limit: config.bodyLimit }));

  // Request ID and access logging
  app.use(requestId);
  app.use(httpLogger);

  // Mount API (v1 alias keeps current frontend compatibility while allowing versioned clients)
  app.use('/api', routes);
  app.use('/api/v1', routes);

  // Friendly root
  app.get('/', (_req, res) => {
    res.json({
      name: 'Gaming Vibe Coding Backend',
      version: '0.2.0',
      docs: '/api/health',
      env: config.env
    });
  });

  // 404 + error handling (must be last)
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
