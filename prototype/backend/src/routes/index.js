/* ============================================================================
   Routes Aggregator
   ========================================================================= */

const express = require('express');
const limiters = require('../middleware/rateLimiter');

const healthRoute = require('./health');
const authRoute = require('./auth');
const tokenRoute = require('./tokens');
const mcqRoute = require('./mcq');
const openaiRoute = require('./openai');
const gamesRoute = require('./games');
const engineRoute = require('./engine');
const generationRoutes = require('./generation');
const statsRoute = require('./stats');

const router = express.Router();

router.use('/health', healthRoute);
router.use('/auth', limiters.default, authRoute);
router.use('/user/tokens', limiters.default, tokenRoute);
router.use('/stats', limiters.default, statsRoute);
router.use('/mcq', limiters.openai, mcqRoute);
router.use('/ai', limiters.openai, openaiRoute);
router.use('/openai', limiters.openai, openaiRoute);
router.use('/engine', limiters.openai, engineRoute);
router.use('/games', limiters.default, gamesRoute);
router.use('/', limiters.generation, generationRoutes);

module.exports = router;
