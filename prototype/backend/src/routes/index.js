/* ============================================================================
   Routes Aggregator
   ========================================================================= */

const express = require('express');
const limiters = require('../middleware/rateLimiter');

const healthRoute = require('./health');
const mcqRoute = require('./mcq');
const engineRoute = require('./engine');
const generationRoutes = require('./generation');

const router = express.Router();

router.use('/health', healthRoute);
router.use('/mcq', limiters.openai, mcqRoute);
router.use('/engine', limiters.openai, engineRoute);
router.use('/', limiters.generation, generationRoutes);

module.exports = router;
