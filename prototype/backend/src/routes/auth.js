/* ============================================================================
   Auth Routes
   ========================================================================= */

const express = require('express');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { registerSchema, loginSchema } = require('../schemas/apiSchemas');
const authService = require('../services/authService');
const tokenService = require('../services/tokenService');

const router = express.Router();

router.post('/register', validate(registerSchema), (req, res) => {
  const result = authService.register(req.body);
  res.status(201).json({
    ...result,
    tokens: tokenService.getBalance(result.user.id)
  });
});

router.post('/login', validate(loginSchema), (req, res) => {
  const result = authService.login(req.body);
  res.json({
    ...result,
    tokens: tokenService.getBalance(result.user.id)
  });
});

router.post('/logout', requireAuth, (_req, res) => {
  res.json({ success: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({
    user: authService.sanitizeUser(req.user),
    tokens: tokenService.getBalance(req.user.id)
  });
});

module.exports = router;
