/* ============================================================================
   Schemas — Barrel Export
   ----------------------------------------------------------------------------
   One-stop import for any schema needed in the codebase.

     const { generateGameSchema, gameJSON3DSchema } = require('../schemas');
   ========================================================================= */

module.exports = {
  ...require('./commonSchemas'),
  ...require('./gameSchemas'),
  ...require('./apiSchemas')
};
