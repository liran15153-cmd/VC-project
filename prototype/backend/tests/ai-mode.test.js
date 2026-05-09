const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'fatal';
process.env.OPENROUTER_API_KEY = 'sk-or-v1-test-key-for-mode-selection';

function freshModeService(mode) {
  process.env.AI_MODE = mode;
  const configPath = require.resolve('../src/config/env');
  const servicePath = require.resolve('../src/services/aiModeService');
  delete require.cache[configPath];
  delete require.cache[servicePath];
  return require('../src/services/aiModeService');
}

test('AI_MODE=real never chooses mock for agent work', () => {
  const mode = freshModeService('real');
  assert.equal(mode.getAIMode(), 'real');
  assert.equal(mode.shouldUseMockForTask('mcq', { prompt: 'simple', gameType: 'platformer', dimension: '2D' }), false);
  assert.equal(mode.shouldUseMockForTask('brief', { prompt: 'simple' }), false);
});

test('AI_MODE=mock uses deterministic local behavior', () => {
  const mode = freshModeService('mock');
  assert.equal(mode.getAIMode(), 'mock');
  assert.equal(mode.shouldUseMockForTask('mcq', { prompt: 'anything' }), true);
  assert.equal(mode.shouldUseMockForTask('brief', { prompt: 'anything' }), true);
});

test('AI_MODE=hybrid saves tokens on predictable questions but keeps real AI for briefs', () => {
  const mode = freshModeService('hybrid');
  assert.equal(mode.getAIMode(), 'hybrid');
  assert.equal(mode.shouldUseMockForTask('mcq', { prompt: 'fox runner', gameType: 'runner', dimension: '2D' }), true);
  assert.equal(mode.shouldUseMockForTask('mcq', { prompt: 'an ambiguous open-world social stealth puzzle with shifting gravity' }), false);
  assert.equal(mode.shouldUseMockForTask('brief', { prompt: 'fox runner' }), false);
});
