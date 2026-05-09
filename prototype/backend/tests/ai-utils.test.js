const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'fatal';
process.env.AI_MODE = 'mock';

const { extractJSON } = require('../src/services/openaiService');
const { compressForLLM } = require('../src/services/promptOptimizer');
const fallbackAI = require('../src/services/fallbackAIService');

test('extractJSON accepts strict JSON and fenced JSON, and rejects invalid JSON', () => {
  assert.deepEqual(extractJSON('{"ok":true}'), { ok: true });
  assert.deepEqual(extractJSON('```json\n{"ok":true}\n```'), { ok: true });
  assert.throws(() => extractJSON('not json'), /No JSON object\/array found/);
});

test('prompt optimizer trims oversized context while preserving latest context', () => {
  const longPrompt = `${'old context '.repeat(300)}\nLATEST USER REQUIREMENT: mobile-first 3D garden repair game`;
  const compressed = compressForLLM(longPrompt, 500);
  assert.equal(compressed.compressed, true);
  assert.ok(compressed.text.length <= 600);
  assert.match(compressed.text, /LATEST USER REQUIREMENT/);
});

test('fallback MockAI is deterministic for tests and offline development', () => {
  const input = {
    prompt: 'Create a fox platformer with gems',
    answers: { pace: 'fast' },
    gameType: 'platformer',
    dimension: '2D'
  };
  assert.deepEqual(fallbackAI.generateGame(input), fallbackAI.generateGame(input));
});

test('fallback is allowed when OpenRouter returns invalid JSON after repair', () => {
  const err = new Error("OpenRouter API error: Invalid JSON response after repair: Expected ',' or ']'");
  assert.equal(fallbackAI.shouldUseFallback(err), true);
});
