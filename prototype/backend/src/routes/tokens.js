/* ============================================================================
   Token Routes
   ========================================================================= */

const express = require('express');
const validate = require('../middleware/validate');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { tokenGrantSchema } = require('../schemas/apiSchemas');
const tokenService = require('../services/tokenService');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  res.json(tokenService.getBalance(req.user.id));
});

router.post('/grant', requireAuth, requireAdmin, validate(tokenGrantSchema), (req, res) => {
  const updated = tokenService.grant(req.body);
  res.json({
    userId: updated.id,
    tokensRemaining: updated.tokenBalance,
    tokensTotal: updated.totalTokens,
    subscription: updated.subscriptionTier
  });
});

module.exports = router;
