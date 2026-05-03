/* ============================================================================
   Gaming Vibe Coding - Backend Server Entry Point
   ========================================================================= */

const config = require('./src/config/env');
const logger = require('./src/utils/logger');
const db = require('./src/db/connection');
const { createApp } = require('./src/app');

async function boot() {
  logger.info('Starting Gaming Vibe Coding backend');

  db.init();
  const app = createApp();

  const server = app.listen(config.port, config.host, () => {
    const url = `http://${config.host}:${config.port}`;
    logger.info(`Server ready at ${url}`);
    logger.info(`Env:      ${config.env}`);
    logger.info(`Database: ${config.database.path}`);
    logger.info(`AI:       ${config.ai.providerLabel} ${config.ai.enabled ? 'enabled (' + config.ai.defaultModel + ')' : 'disabled (set API key)'}`);
    logger.info(`Health:   ${url}/api/health`);
    logger.info('');
    logger.info('Endpoints:');
    logger.info('  POST   /api/auth/register');
    logger.info('  POST   /api/auth/login');
    logger.info('  GET    /api/auth/me');
    logger.info('  GET    /api/user/tokens');
    logger.info('  POST   /api/mcq/generate');
    logger.info('  POST   /api/engine/generate');
    logger.info('  POST   /api/ai (admin, optional)');
    logger.info('  POST   /api/openai (legacy alias)');
    logger.info('  POST   /api/generate-game');
    logger.info('  POST   /api/edit-game');
    logger.info('  GET    /api/games');
    logger.info('  POST   /api/games');
    logger.info('  GET    /api/games/:id');
    logger.info('  PUT    /api/games/:id');
    logger.info('  DELETE /api/games/:id');
    logger.info('  GET    /api/games/:id/download');
    logger.info('  GET    /api/stats (admin)');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.fatal(
        { port: config.port, host: config.host },
        `Port ${config.port} is already in use. Stop the existing backend process or set PORT to another value.`
      );
      process.exit(1);
    }
    logger.fatal({ err }, 'HTTP server failed');
    process.exit(1);
  });

  const signals = ['SIGINT', 'SIGTERM'];
  let shuttingDown = false;

  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received - shutting down gracefully`);

    server.close((err) => {
      if (err) {
        if (err.code === 'ERR_SERVER_NOT_RUNNING') {
          logger.info('HTTP server was not running');
          try {
            db.close();
          } catch (dbErr) {
            logger.error({ err: dbErr }, 'Error closing database');
          }
          process.exit(0);
        }
        logger.error({ err }, 'Error closing HTTP server');
        process.exit(1);
      }
      logger.info('HTTP server closed');

      try {
        db.close();
      } catch (dbErr) {
        logger.error({ err: dbErr }, 'Error closing database');
      }

      logger.info('Goodbye');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Forcing shutdown after timeout');
      process.exit(1);
    }, 10000).unref();
  }

  signals.forEach((sig) => process.on(sig, () => shutdown(sig)));

  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception');
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'Unhandled promise rejection');
    shutdown('unhandledRejection');
  });
}

boot().catch((err) => {
  logger.fatal({ err }, 'Failed to boot server');
  process.exit(1);
});
