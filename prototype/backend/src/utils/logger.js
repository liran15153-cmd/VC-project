/* ============================================================================
   Pino Logger
   ----------------------------------------------------------------------------
   Fast structured logging. Pretty-prints in dev, JSON in prod.
   ========================================================================= */

const pino = require('pino');
const config = require('../config/env');

const isDev = config.isDev;

const logger = pino({
  level: config.logging.level,
  base: { service: 'gvc-backend' },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label })
  },
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss.l',
        ignore: 'pid,hostname,service',
        messageFormat: '{msg}'
      }
    }
  })
});

module.exports = logger;
