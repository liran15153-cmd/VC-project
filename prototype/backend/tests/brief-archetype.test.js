const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'fatal';
process.env.AI_MODE = 'mock';
process.env.AI_FALLBACK_ENABLED = 'true';
process.env.OPENROUTER_API_KEY = 'replace-with-your-openrouter-api-key';

const { buildGameBriefPrompt } = require('../src/services/promptService');
const { classifyArchetype, getArchetypeProfile } = require('../src/classifier');
const { createApp } = require('../src/app');

let server;
let baseUrl;

test.before(async () => {
  const app = createApp();
  server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function request(method, pathname, { body } = {}) {
  const res = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined
  });
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();
  return { res, data };
}

test('brief prompt with archetype emits ARCHETYPE GUIDANCE, the archetype id, and the no-invent rule', () => {
  const profile = getArchetypeProfile('platformer_3d');
  const userPrompt = buildGameBriefPrompt({
    prompt: 'Make a 3D mario',
    answers: {},
    gameType: 'platformer',
    dimension: '3D',
    existingAssets: [],
    archetype: profile
  });

  assert.match(userPrompt, /ARCHETYPE GUIDANCE:/);
  assert.match(userPrompt, /Archetype: platformer_3d/);
  assert.match(userPrompt, /dimension: 3D/);
  assert.match(userPrompt, /perspective: side-view-3d/);
  assert.match(userPrompt, /Camera:/);
  assert.match(userPrompt, /Physics:/);
  assert.match(userPrompt, /Expected controls:/);
  assert.match(userPrompt, /Core entities:/);
  assert.match(userPrompt, /Asset roles:/);
  assert.match(userPrompt, /Avoid:/);
  assert.match(userPrompt, /Asset keys are resolved later — do not invent asset keys in this brief\./);
});

test('brief prompt WITHOUT archetype is the legacy block (regression guard)', () => {
  const baseline = buildGameBriefPrompt({
    prompt: 'Make a 3D mario',
    answers: {},
    gameType: 'platformer',
    dimension: '3D',
    existingAssets: []
  });

  assert.doesNotMatch(baseline, /ARCHETYPE GUIDANCE:/);
  assert.doesNotMatch(baseline, /do not invent asset keys in this brief/);
  // The legacy block still ends with the canonical instructions.
  assert.match(baseline, /Return JSON only\./);
  assert.match(baseline, /RAW USER GAME IDEA: Make a 3D mario/);
});

test('classification is consistent between classifier and brief prompt content', () => {
  const classification = classifyArchetype({
    rawPrompt: 'top down zombie survival',
    dimension: '3D'
  });
  assert.equal(classification.archetype, 'top_down_3d');

  const userPrompt = buildGameBriefPrompt({
    prompt: 'top down zombie survival',
    dimension: classification.dimension,
    archetype: classification.archetypeProfile
  });
  assert.match(userPrompt, /Archetype: top_down_3d/);
  assert.match(userPrompt, /KNOWN DIMENSION: 3D/);
});

test('POST /api/brief/generate exposes meta.classifier with archetype + dimension', async () => {
  const { res, data } = await request('POST', '/api/brief/generate', {
    body: {
      prompt: 'tower defense with waves and lasers',
      answers: {},
      gameType: 'platformer',
      dimension: '3D',
      existingAssets: []
    }
  });
  assert.equal(res.status, 200, JSON.stringify(data).slice(0, 400));
  assert.ok(data.brief, 'brief missing in response');
  assert.ok(data.meta, 'meta missing in response');
  assert.ok(data.meta.classifier, 'meta.classifier missing in response');

  const c = data.meta.classifier;
  // tower_defense has dimensionLock='any' — should NOT be projected.
  assert.equal(c.archetype, 'tower_defense');
  assert.equal(c.dimension, '3D');
  assert.equal(c.dimensionSource, 'user');
  assert.ok(['user', 'mcq', 'llm', 'heuristic'].includes(c.source));
  assert.ok(typeof c.confidenceScore === 'number' && c.confidenceScore >= 0 && c.confidenceScore <= 1);
  assert.ok(Array.isArray(c.warnings));
  assert.ok(typeof c.reasoningShort === 'string' && c.reasoningShort.length > 0);
});

test('POST /api/brief/generate: classifier projects platformer + user 3D → platformer_3d', async () => {
  const { res, data } = await request('POST', '/api/brief/generate', {
    body: {
      prompt: 'make me a platformer with coins and spikes',
      answers: {},
      gameType: 'platformer',
      dimension: '3D',
      existingAssets: []
    }
  });
  assert.equal(res.status, 200, JSON.stringify(data).slice(0, 400));
  assert.equal(data.meta.classifier.archetype, 'platformer_3d');
  assert.equal(data.meta.classifier.dimensionSource, 'user');
});
