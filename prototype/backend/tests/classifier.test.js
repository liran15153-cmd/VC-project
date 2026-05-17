const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'fatal';

const {
  classifyArchetype,
  getArchetypeProfile,
  listAllArchetypeIds
} = require('../src/classifier');

const EXPECTED_ARCHETYPES = [
  'platformer_2d', 'top_down_2d', 'grid_logic', 'tower_defense', 'ui_heavy',
  'platformer_3d', 'third_person_3d', 'first_person_3d', 'top_down_3d',
  'vehicle_3d', 'hybrid_2_5d', 'on_rails_shooter'
];

test('classifier registry exposes all 12 expected archetypes', () => {
  const ids = listAllArchetypeIds().sort();
  assert.deepEqual(ids, EXPECTED_ARCHETYPES.slice().sort());
  for (const id of EXPECTED_ARCHETYPES) {
    const profile = getArchetypeProfile(id);
    assert.ok(profile, `profile missing: ${id}`);
    assert.equal(profile.id, id);
    assert.ok(['2D', '3D', 'hybrid'].includes(profile.dimension), `bad dimension for ${id}`);
    assert.ok(['2D', '3D', 'hybrid', 'any'].includes(profile.dimensionLock), `bad dimensionLock for ${id}`);
    assert.ok(profile.camera && profile.physics && profile.defaultControls, `incomplete profile: ${id}`);
    assert.ok(Array.isArray(profile.commonEntities), `commonEntities missing for ${id}`);
    assert.ok(Array.isArray(profile.commonAssetRoles), `commonAssetRoles missing for ${id}`);
    assert.ok(Array.isArray(profile.commonFailureModes), `commonFailureModes missing for ${id}`);
    assert.ok(typeof profile.briefGuidance === 'string' && profile.briefGuidance.length > 0, `briefGuidance missing for ${id}`);
  }
});

test('A: "mario style" with no dimension → platformer_2d / heuristic / 2D from profile default', () => {
  const result = classifyArchetype({ rawPrompt: 'make me a mario style game' });
  assert.equal(result.archetype, 'platformer_2d');
  assert.equal(result.source, 'heuristic');
  assert.equal(result.dimension, '2D');
  // Prompt contains no explicit "2D" / "3D" / "hybrid" word; dim comes from the
  // archetype profile's natural dimension, so dimensionSource stays 'default'.
  assert.equal(result.dimensionSource, 'default');
});

test('B: "3D mario style" → platformer_3d / dimension=3D from prompt hint', () => {
  const result = classifyArchetype({ rawPrompt: 'make me a 3D mario style game' });
  assert.equal(result.archetype, 'platformer_3d');
  assert.equal(result.dimension, '3D');
  assert.equal(result.dimensionSource, 'heuristic');
});

test('C: "platformer" + user dimension=3D → platformer_3d, dimensionSource=user, projected', () => {
  const result = classifyArchetype({ rawPrompt: 'platformer', dimension: '3D' });
  assert.equal(result.archetype, 'platformer_3d');
  assert.equal(result.source, 'heuristic');
  assert.equal(result.dimensionSource, 'user');
  assert.ok(Math.abs(result.confidenceScore - 0.55) < 0.001, `expected ~0.55 conf, got ${result.confidenceScore}`);
  assert.ok(result.warnings.some((w) => /projected to "platformer_3d"/.test(w)), 'expected projection warning');
});

test('D: "first person maze shooter" → first_person_3d, dimension=3D', () => {
  const result = classifyArchetype({ rawPrompt: 'first person maze shooter' });
  assert.equal(result.archetype, 'first_person_3d');
  assert.equal(result.dimension, '3D');
});

test('E1: "top down zombie survival" with no dimension → top_down_2d', () => {
  const result = classifyArchetype({ rawPrompt: 'top down zombie survival' });
  assert.equal(result.archetype, 'top_down_2d');
  assert.equal(result.dimension, '2D');
});

test('E2: "top down zombie survival" with user dimension=3D → top_down_3d / dimensionSource=user', () => {
  const result = classifyArchetype({ rawPrompt: 'top down zombie survival', dimension: '3D' });
  assert.equal(result.archetype, 'top_down_3d');
  assert.equal(result.dimension, '3D');
  assert.equal(result.dimensionSource, 'user');
});

test('F: "mobile endless runner with 2.5D visuals" → hybrid_2_5d / dimension=hybrid', () => {
  const result = classifyArchetype({ rawPrompt: 'mobile endless runner with 2.5D visuals' });
  assert.equal(result.archetype, 'hybrid_2_5d');
  assert.equal(result.dimension, 'hybrid');
});

test('G: "tower defense with waves" → tower_defense (dimensionLock=any honoured)', () => {
  const result = classifyArchetype({ rawPrompt: 'tower defense with waves' });
  assert.equal(result.archetype, 'tower_defense');
  assert.equal(getArchetypeProfile(result.archetype).dimensionLock, 'any');
});

test('H: "2D side scroller" + user dimension=3D → user wins (platformer_3d), warning fires', () => {
  const result = classifyArchetype({ rawPrompt: 'make me a 2D side scroller', dimension: '3D' });
  assert.equal(result.archetype, 'platformer_3d');
  assert.equal(result.dimension, '3D');
  assert.equal(result.dimensionSource, 'user');
  assert.ok(
    result.warnings.some((w) => /projected to "platformer_3d"/.test(w)),
    `expected a projection warning, got ${JSON.stringify(result.warnings)}`
  );
});

test('I: user dim=2D + MCQ value "three-d world" + prompt "mario" → 2D wins, dimensionSource=user', () => {
  const result = classifyArchetype({
    rawPrompt: 'mario',
    dimension: '2D',
    mcqAnswers: { q_dimension: 'three-d world' }
  });
  assert.equal(result.archetype, 'platformer_2d');
  assert.equal(result.dimension, '2D');
  assert.equal(result.dimensionSource, 'user');
});

test('J: "sokoban puzzle" + user dim=3D → grid_logic kept (dimensionLock=any), dim travels', () => {
  const result = classifyArchetype({ rawPrompt: 'sokoban puzzle', dimension: '3D' });
  assert.equal(result.archetype, 'grid_logic');
  assert.equal(result.dimension, '3D');
  assert.equal(result.dimensionSource, 'user');
  assert.deepEqual(result.warnings.filter((w) => /projected/.test(w)), []);
});

test('K: empty prompt + no MCQ + no dim → platformer_2d / default / conf=0.4 / warning', () => {
  const result = classifyArchetype({ rawPrompt: '' });
  assert.equal(result.archetype, 'platformer_2d');
  assert.equal(result.source, 'heuristic');
  assert.equal(result.dimensionSource, 'default');
  assert.equal(result.dimension, '2D');
  assert.ok(Math.abs(result.confidenceScore - 0.4) < 0.001, `expected 0.4 conf, got ${result.confidenceScore}`);
  assert.ok(result.warnings.some((w) => /no signal/.test(w)), `expected 'no signal' warning, got ${JSON.stringify(result.warnings)}`);
});

test('MCQ dimension hint is picked up when user did not specify dimension', () => {
  const result = classifyArchetype({
    rawPrompt: 'mario',
    mcqAnswers: { perspective_q: 'three-d world preferred' }
  });
  assert.equal(result.dimension, '3D');
  assert.equal(result.dimensionSource, 'mcq');
  assert.equal(result.archetype, 'platformer_3d');
});

test('MCQ archetype id verbatim wins archetype selection', () => {
  const result = classifyArchetype({
    rawPrompt: 'mario',
    mcqAnswers: { genre_q: 'tower_defense' }
  });
  assert.equal(result.archetype, 'tower_defense');
  assert.equal(result.source, 'mcq');
  assert.ok(Math.abs(result.confidenceScore - 0.85) < 0.001, `expected 0.85 conf, got ${result.confidenceScore}`);
});

test('gameType naming an archetype id directly → source=user, conf=1.0', () => {
  const result = classifyArchetype({ rawPrompt: 'something', gameType: 'top_down_2d' });
  assert.equal(result.archetype, 'top_down_2d');
  assert.equal(result.source, 'user');
  assert.equal(result.confidenceScore, 1.0);
});

test('classifier never invents asset keys (smoke check on profile bookkeeping)', () => {
  const result = classifyArchetype({ rawPrompt: 'mario' });
  assert.ok(result.archetypeProfile);
  assert.ok(!('assetKey' in result.archetypeProfile), 'profile must not contain assetKey');
  assert.ok(!('assets' in result.archetypeProfile), 'profile must not contain assets list');
});
