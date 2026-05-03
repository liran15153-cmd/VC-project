/* ============================================================================
   Stats Route — GET /api/stats
   ----------------------------------------------------------------------------
   Returns aggregated analytics:
     - Game counts (total, by genre, by dimension)
     - Avg generation time
     - Token spend breakdown
     - Recent events
   Useful for an internal admin dashboard later.
   ========================================================================= */

const express = require('express');
const validate = require('../middleware/validate');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { statsEventsQuerySchema } = require('../schemas/apiSchemas');
const analytics = require('../db/analytics');

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get('/', (_req, res) => {
  res.json(analytics.getStats());
});

router.get('/events', validate(statsEventsQuerySchema, 'query'), (req, res) => {
  const limit = req.query.limit || 50;
  res.json({
    events: analytics.getRecentEvents(limit)
  });
});

module.exports = router;
