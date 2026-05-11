/* ============================================================================
   Asset Resolver Routes
   ----------------------------------------------------------------------------
   Deterministic Agent 02 endpoint. Resolves Game Brief asset needs against the
   local registry without generating new asset files.
   ========================================================================= */

const express = require('express');
const validate = require('../middleware/validate');
const { assetResolveSchema } = require('../schemas/apiSchemas');
const { resolveAssetsForBrief } = require('../services/assetResolutionService');

const router = express.Router();

router.post('/resolve', validate(assetResolveSchema), (req, res, next) => {
  try {
    const debug = req.body.debug || req.query.debug === 'true' || req.query.debug === '1';
    const assetResolution = resolveAssetsForBrief({ ...req.body, debug });
    res.json({ assetResolution });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
