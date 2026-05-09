/* ============================================================================
   AI Mode Service
   ----------------------------------------------------------------------------
   Keeps OpenRouter as the real intelligence layer while allowing deterministic
   local behavior for tests, emergency fallback, and cheap predictable steps.
   ========================================================================= */

const config = require('../config/env');

function getAIMode() {
  return config.ai.mode;
}

function shouldUseMockForTask(task, input = {}) {
  const mode = getAIMode();
  if (mode === 'mock') return true;
  if (mode === 'real') return false;

  const prompt = String(input.prompt || '').trim();
  if (task === 'mcq') {
    return prompt.length < 90 && Boolean(input.gameType) && Boolean(input.dimension);
  }

  if (task === 'placeholder') return true;
  return false;
}

function shouldUseRealForTask(task, input = {}) {
  return !shouldUseMockForTask(task, input);
}

module.exports = {
  getAIMode,
  shouldUseMockForTask,
  shouldUseRealForTask
};
