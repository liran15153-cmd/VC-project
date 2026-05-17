/* ============================================================================
 * Debug Protocol — Stage 1 unit tests
 * ----------------------------------------------------------------------------
 * Verifies the deterministic diagnostics layer. No LLM, no repair.
 * ========================================================================= */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'fatal';

const {
  runAllChecks,
  checkCameraConsistency,
  checkVisibility,
  checkAssetConsistency,
  checkBehaviorReferences,
  checkTweenReferences,
  checkEngineFlagsVsContent,
  checkRigidBodyQuality,
  checkInputBindings
} = require('../src/debugProtocol/validator');

const {
  runDebugDiagnostics,
  summarizeDiagnostics,
  formatDiagnosticsReport,
  loadSeedProtocol
} = require('../src/debugProtocol/diagnostics');

const {
  DIAGNOSTIC_CODES,
  SEVERITY,
  createDiagnostic
} = require('../src/debugProtocol/types');

const {
  validateEngineGameDefinitionSafe
} = require('../src/schemas/engineGameDefinitionSchema');

// ─── helpers ───────────────────────────────────────────────────────────────

const fixtureDir = path.resolve(__dirname, '../../..', 'test-fixtures/game-definitions');
function loadFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(fixtureDir, name), 'utf8'));
}

function validate(input) {
  const check = validateEngineGameDefinitionSafe(input);
  if (!check.ok) throw new Error(`fixture failed schema: ${check.errors.map((e) => e.message).join('; ')}`);
  return check;
}

function codesOf(diagnostics) {
  return diagnostics.map((d) => d.code).sort();
}

// ─── types.js ──────────────────────────────────────────────────────────────

test('createDiagnostic requires code, severity, message', () => {
  assert.throws(() => createDiagnostic({}), /code is required/);
  assert.throws(() => createDiagnostic({ code: 'X' }), /severity/);
  assert.throws(() => createDiagnostic({ code: 'X', severity: 'oops', message: 'm' }), /severity must be/);
  assert.throws(() => createDiagnostic({ code: 'X', severity: SEVERITY.WARNING }), /message is required/);
});

test('createDiagnostic returns a normalized record', () => {
  const d = createDiagnostic({
    code: DIAGNOSTIC_CODES.UNUSED_ASSET,
    severity: SEVERITY.WARNING,
    message: 'unused',
    jsonPointer: '/assets/0',
    suggestedFixText: 'remove it'
  });
  assert.equal(d.code, 'UNUSED_ASSET');
  assert.equal(d.severity, 'warning');
  assert.equal(d.message, 'unused');
  assert.equal(d.jsonPointer, '/assets/0');
  assert.equal(d.suggestedFixText, 'remove it');
});

// ─── golden path: valid fixtures don't trigger any errors ──────────────────

test('valid-3d fixture: schema passes, diagnostics emit no errors', () => {
  const fixture = loadFixture('valid-3d.json');
  const { data, warnings } = validate(fixture);
  const report = runDebugDiagnostics(data, { schemaResult: { ok: true }, normalizationWarnings: warnings });
  assert.equal(report.schemaOk, true);
  assert.equal(report.counts.error, 0, `unexpected errors: ${JSON.stringify(report.diagnostics)}`);
  // The fixture intentionally declares one unused asset would be flagged — assert there are no error-severity diagnostics.
});

test('valid-hybrid fixture: schema passes, diagnostics emit no errors', () => {
  const fixture = loadFixture('valid-hybrid.json');
  const { data, warnings } = validate(fixture);
  const report = runDebugDiagnostics(data, { schemaResult: { ok: true }, normalizationWarnings: warnings });
  assert.equal(report.schemaOk, true);
  assert.equal(report.counts.error, 0, `unexpected errors: ${JSON.stringify(report.diagnostics)}`);
});

test('valid-2d fixture: schema passes, diagnostics emit no errors', () => {
  const fixture = loadFixture('valid-2d.json');
  const { data, warnings } = validate(fixture);
  const report = runDebugDiagnostics(data, { schemaResult: { ok: true }, normalizationWarnings: warnings });
  assert.equal(report.schemaOk, true);
  assert.equal(report.counts.error, 0, `unexpected errors: ${JSON.stringify(report.diagnostics)}`);
});

// ─── schema-rejected cases: validators are never reached ───────────────────

test('missing-asset-references fixture is rejected by schema (no diagnostics needed)', () => {
  const fixture = loadFixture('missing-asset-references.json');
  const check = validateEngineGameDefinitionSafe(fixture);
  assert.equal(check.ok, false, 'schema should reject undeclared asset reference');
  // Diagnostics layer is gated on schema success. When called on the schema
  // failure path, it should report ran=false and emit zero diagnostics.
  const report = runDebugDiagnostics(null, { schemaResult: { ok: false, errors: check.errors } });
  assert.equal(report.ran, false);
  assert.equal(report.schemaOk, false);
  assert.deepEqual(report.diagnostics, []);
});

test('invalid switchScene target is rejected by schema', () => {
  const definition = {
    schemaVersion: 1,
    metadata: { title: 'invalid switchScene' },
    scenes: [
      {
        key: 'main',
        entities: [],
        behaviors: [
          {
            trigger: 'sceneStart',
            actions: [{ type: 'switchScene', scene: 'does-not-exist' }]
          }
        ]
      }
    ],
    initialScene: 'main'
  };
  const check = validateEngineGameDefinitionSafe(definition);
  assert.equal(check.ok, false);
  assert.match(check.errors.map((e) => e.message).join(' '), /does-not-exist/);
});

test('missing initialScene is rejected by schema (or auto-normalized)', () => {
  const definition = {
    schemaVersion: 1,
    metadata: { title: 'no-initial' },
    scenes: [{ key: 'main', entities: [] }],
    initialScene: 'nope'
  };
  const check = validateEngineGameDefinitionSafe(definition);
  // Normalizer aliases unknown initialScene to scenes[0].key.
  assert.equal(check.ok, true);
  assert.equal(check.data.initialScene, 'main');
});

// ─── category 1: camera consistency ────────────────────────────────────────

test('SCENE_HAS_CAMERA_NO_TARGET fires when camera system present but no cameraTarget', () => {
  const definition = {
    schemaVersion: 1,
    metadata: { title: 't' },
    scenes: [
      {
        key: 'main',
        systems: ['physicsSync', 'camera'],
        entities: [{ key: 'block', mesh: { shape: 'box' } }]
      }
    ],
    initialScene: 'main'
  };
  const { data } = validate(definition);
  const diagnostics = checkCameraConsistency(data);
  assert.deepEqual(codesOf(diagnostics), [DIAGNOSTIC_CODES.SCENE_HAS_CAMERA_NO_TARGET]);
  assert.equal(diagnostics[0].severity, SEVERITY.WARNING);
  assert.match(diagnostics[0].jsonPointer, /scenes\/0\/systems/);
});

test('CAMERA_TARGET_BUT_NO_CAMERA_SYSTEM fires when entity has cameraTarget but scene omits camera system', () => {
  const definition = {
    schemaVersion: 1,
    metadata: { title: 't' },
    scenes: [
      {
        key: 'main',
        systems: ['physicsSync'],
        entities: [
          { key: 'player', mesh: { shape: 'box' }, cameraTarget: {} }
        ]
      }
    ],
    initialScene: 'main'
  };
  const { data } = validate(definition);
  const diagnostics = checkCameraConsistency(data);
  assert.deepEqual(codesOf(diagnostics), [DIAGNOSTIC_CODES.CAMERA_TARGET_BUT_NO_CAMERA_SYSTEM]);
});

// ─── category 2: visibility ────────────────────────────────────────────────

test('ZERO_TRANSFORM_SCALE fires when any axis of transform.scale is 0', () => {
  const definition = {
    schemaVersion: 1,
    metadata: { title: 't' },
    scenes: [
      {
        key: 'main',
        entities: [
          {
            key: 'ghost',
            transform: { scale: { x: 0, y: 1, z: 1 } },
            mesh: { shape: 'box', size: { x: 1, y: 1, z: 1 } }
          }
        ]
      }
    ],
    initialScene: 'main'
  };
  const { data } = validate(definition);
  const diagnostics = checkVisibility(data);
  assert.ok(diagnostics.some((d) => d.code === DIAGNOSTIC_CODES.ZERO_TRANSFORM_SCALE), `got: ${codesOf(diagnostics)}`);
});

test('ZERO_MODEL_SCALE fires when model.scale has zero axis', () => {
  const definition = {
    schemaVersion: 1,
    metadata: { title: 't' },
    assets: [{ key: 'm', type: 'gltf', url: '/assets/m.glb' }],
    scenes: [
      {
        key: 'main',
        entities: [
          {
            key: 'ghost',
            model: { assetKey: 'm', scale: { x: 1, y: 0, z: 1 } }
          }
        ]
      }
    ],
    initialScene: 'main'
  };
  const { data } = validate(definition);
  const diagnostics = checkVisibility(data);
  assert.ok(diagnostics.some((d) => d.code === DIAGNOSTIC_CODES.ZERO_MODEL_SCALE));
});

test('ZERO_MESH_DIMENSION fires when mesh.size has zero axis', () => {
  const definition = {
    schemaVersion: 1,
    metadata: { title: 't' },
    scenes: [
      {
        key: 'main',
        entities: [{ key: 'flat', mesh: { shape: 'box', size: { x: 1, y: 0, z: 1 } } }]
      }
    ],
    initialScene: 'main'
  };
  const { data } = validate(definition);
  const diagnostics = checkVisibility(data);
  assert.ok(diagnostics.some((d) => d.code === DIAGNOSTIC_CODES.ZERO_MESH_DIMENSION));
});

// ─── category 3: asset consistency ─────────────────────────────────────────

test('DUPLICATE_ASSET_KEY fires when two assets share a key', () => {
  const definition = {
    schemaVersion: 1,
    metadata: { title: 't' },
    assets: [
      { key: 'a', type: 'gltf', url: '/a.glb' },
      { key: 'a', type: 'gltf', url: '/a2.glb' }
    ],
    scenes: [
      {
        key: 'main',
        entities: [{ key: 'e', model: { assetKey: 'a' } }]
      }
    ],
    initialScene: 'main'
  };
  const { data } = validate(definition);
  const diagnostics = checkAssetConsistency(data);
  const codes = codesOf(diagnostics);
  assert.ok(codes.includes(DIAGNOSTIC_CODES.DUPLICATE_ASSET_KEY), `got: ${codes}`);
  const dup = diagnostics.find((d) => d.code === DIAGNOSTIC_CODES.DUPLICATE_ASSET_KEY);
  assert.equal(dup.severity, SEVERITY.ERROR);
});

test('UNUSED_ASSET fires when an asset has no reference', () => {
  const definition = {
    schemaVersion: 1,
    metadata: { title: 't' },
    assets: [
      { key: 'used', type: 'gltf', url: '/used.glb' },
      { key: 'orphan', type: 'image', url: '/orphan.png' }
    ],
    scenes: [
      {
        key: 'main',
        entities: [{ key: 'e', model: { assetKey: 'used' } }]
      }
    ],
    initialScene: 'main'
  };
  const { data } = validate(definition);
  const diagnostics = checkAssetConsistency(data);
  const unused = diagnostics.filter((d) => d.code === DIAGNOSTIC_CODES.UNUSED_ASSET);
  assert.equal(unused.length, 1);
  assert.match(unused[0].message, /orphan/);
});

// ─── category 4: behavior references ───────────────────────────────────────

test('BEHAVIOR_TARGET_MISSING fires when action.target is not an entity', () => {
  const definition = {
    schemaVersion: 1,
    metadata: { title: 't' },
    scenes: [
      {
        key: 'main',
        entities: [{ key: 'real', mesh: { shape: 'box' } }],
        behaviors: [
          {
            trigger: 'sceneStart',
            actions: [{ type: 'applyImpulse', target: 'nobody', value: { x: 0, y: 1, z: 0 } }]
          }
        ]
      }
    ],
    initialScene: 'main'
  };
  const { data } = validate(definition);
  const diagnostics = checkBehaviorReferences(data);
  assert.ok(diagnostics.some((d) => d.code === DIAGNOSTIC_CODES.BEHAVIOR_TARGET_MISSING));
});

test('BEHAVIOR_STATE_KEY_MISSING fires when setState/incrementState references undeclared state', () => {
  const definition = {
    schemaVersion: 1,
    metadata: { title: 't' },
    state: { score: 0 },
    scenes: [
      {
        key: 'main',
        entities: [{ key: 'e', mesh: { shape: 'box' } }],
        behaviors: [
          {
            trigger: 'sceneStart',
            actions: [{ type: 'incrementState', stateKey: 'lives', amount: -1 }]
          }
        ]
      }
    ],
    initialScene: 'main'
  };
  const { data } = validate(definition);
  const diagnostics = checkBehaviorReferences(data);
  assert.ok(diagnostics.some((d) => d.code === DIAGNOSTIC_CODES.BEHAVIOR_STATE_KEY_MISSING));
});

// ─── category 5: tween references ──────────────────────────────────────────

test('TWEEN_TARGET_MISSING fires when tween.target entity does not exist', () => {
  const definition = {
    schemaVersion: 1,
    metadata: { title: 't' },
    scenes: [
      {
        key: 'main',
        entities: [{ key: 'real', mesh: { shape: 'box' } }],
        animations: [{ target: 'phantom', property: 'position.x', from: 0, to: 1 }]
      }
    ],
    initialScene: 'main'
  };
  const { data } = validate(definition);
  const diagnostics = checkTweenReferences(data);
  assert.ok(diagnostics.some((d) => d.code === DIAGNOSTIC_CODES.TWEEN_TARGET_MISSING));
});

// ─── category 6: engine flags ──────────────────────────────────────────────

test('engine.enable3D=false but 3D content: normalization re-enables; diagnostic does not fire on normalized data', () => {
  // After normalization (which is part of validateEngineGameDefinitionSafe),
  // engine.enable3D is forced back to true. So the diagnostic should NOT fire
  // on the post-normalization data — the normalizer protected us.
  const definition = {
    schemaVersion: 1,
    metadata: { title: 't' },
    engine: { enable3D: false, enable2D: true, enablePhysics: true },
    scenes: [
      {
        key: 'main',
        entities: [{ key: 'e', mesh: { shape: 'box' } }]
      }
    ],
    initialScene: 'main'
  };
  const { data } = validate(definition);
  assert.equal(data.engine.enable3D, true, 'normalization should re-enable 3D');
  const diagnostics = checkEngineFlagsVsContent(data);
  assert.deepEqual(diagnostics, []);
});

test('engine flag diagnostics fire when called directly on a hand-built mismatched definition (bypassing normalization)', () => {
  // Synthetic definition: simulates a state where normalization did not run.
  const data = {
    engine: { enable3D: false, enable2D: false, enablePhysics: false },
    ui: [],
    prefabs: {},
    scenes: [
      {
        key: 'main',
        ui: [{ type: 'text', text: 'hi' }],
        entities: [
          { key: 'e', mesh: { shape: 'box' }, rigidBody: { type: 'dynamic' }, sprite: { kind: 'text', text: 'x' } }
        ]
      }
    ]
  };
  const diagnostics = checkEngineFlagsVsContent(data);
  const codes = codesOf(diagnostics);
  assert.ok(codes.includes(DIAGNOSTIC_CODES.THREE_D_DISABLED_BUT_HAS_3D));
  assert.ok(codes.includes(DIAGNOSTIC_CODES.TWO_D_DISABLED_BUT_HAS_2D));
  assert.ok(codes.includes(DIAGNOSTIC_CODES.PHYSICS_DISABLED_BUT_RIGIDBODY));
});

// ─── category 7: rigidBody quality ─────────────────────────────────────────

test('RIGIDBODY_NO_VISUAL fires for collider-only entity', () => {
  const definition = {
    schemaVersion: 1,
    metadata: { title: 't' },
    scenes: [
      {
        key: 'main',
        entities: [
          {
            key: 'wall',
            rigidBody: { type: 'static', collider: { shape: 'cuboid', halfExtents: { x: 1, y: 1, z: 1 } } }
          }
        ]
      }
    ],
    initialScene: 'main'
  };
  const { data } = validate(definition);
  const diagnostics = checkRigidBodyQuality(data);
  assert.ok(diagnostics.some((d) => d.code === DIAGNOSTIC_CODES.RIGIDBODY_NO_VISUAL));
});

// ─── category 8: input bindings ────────────────────────────────────────────

test('INPUT_BINDINGS_EMPTY_WITH_PLAYER does not fire after normalization', () => {
  // Normalization auto-injects bindings when it detects a "player" entity.
  // So after schema+normalize, this diagnostic should not fire.
  const definition = {
    schemaVersion: 1,
    metadata: { title: 't' },
    scenes: [
      {
        key: 'main',
        entities: [
          {
            key: 'player',
            mesh: { shape: 'box' },
            rigidBody: { type: 'dynamic', collider: { shape: 'cuboid', halfExtents: { x: 0.5, y: 0.5, z: 0.5 } } }
          }
        ]
      }
    ],
    initialScene: 'main'
  };
  const { data } = validate(definition);
  // Normalizer should have injected defaults.
  assert.ok(Object.keys(data.inputBindings || {}).length > 0, 'expected default input bindings');
  const diagnostics = checkInputBindings(data);
  assert.deepEqual(diagnostics, []);
});

test('INPUT_BINDINGS_EMPTY_WITH_PLAYER fires on synthetic post-normalization data', () => {
  // Synthetic case: somehow a definition reaches diagnostics with both
  // a controlled player AND no input bindings.
  const data = {
    inputBindings: {},
    prefabs: {},
    scenes: [
      {
        key: 'main',
        entities: [
          {
            key: 'player1',
            rigidBody: { type: 'dynamic', collider: { shape: 'cuboid', halfExtents: { x: 1, y: 1, z: 1 } } }
          }
        ]
      }
    ]
  };
  const diagnostics = checkInputBindings(data);
  assert.deepEqual(codesOf(diagnostics), [DIAGNOSTIC_CODES.INPUT_BINDINGS_EMPTY_WITH_PLAYER]);
});

// ─── orchestration / aggregation ───────────────────────────────────────────

test('runAllChecks aggregates diagnostics from every category', () => {
  const definition = {
    schemaVersion: 1,
    metadata: { title: 't' },
    state: { score: 0 },
    assets: [
      { key: 'used', type: 'gltf', url: '/used.glb' },
      { key: 'orphan', type: 'image', url: '/orphan.png' }
    ],
    scenes: [
      {
        key: 'main',
        systems: ['physicsSync', 'camera'],
        entities: [
          {
            key: 'hero',
            transform: { scale: { x: 0, y: 1, z: 1 } },
            model: { assetKey: 'used' }
          }
        ],
        behaviors: [
          {
            trigger: 'sceneStart',
            actions: [{ type: 'applyImpulse', target: 'no-such-entity', value: { x: 0, y: 1, z: 0 } }]
          }
        ],
        animations: [{ target: 'no-such-entity', property: 'position.x', from: 0, to: 1 }]
      }
    ],
    initialScene: 'main'
  };
  const { data } = validate(definition);
  const diagnostics = runAllChecks(data);
  const codes = codesOf(diagnostics);
  assert.ok(codes.includes(DIAGNOSTIC_CODES.SCENE_HAS_CAMERA_NO_TARGET));
  assert.ok(codes.includes(DIAGNOSTIC_CODES.ZERO_TRANSFORM_SCALE));
  assert.ok(codes.includes(DIAGNOSTIC_CODES.UNUSED_ASSET));
  assert.ok(codes.includes(DIAGNOSTIC_CODES.BEHAVIOR_TARGET_MISSING));
  assert.ok(codes.includes(DIAGNOSTIC_CODES.TWEEN_TARGET_MISSING));
});

test('runDebugDiagnostics returns ran=false on schema failure', () => {
  const report = runDebugDiagnostics(null, {
    schemaResult: { ok: false, errors: [{ path: 'x', message: 'bad' }] }
  });
  assert.equal(report.ran, false);
  assert.equal(report.schemaOk, false);
  assert.equal(report.schemaErrorCount, 1);
  assert.deepEqual(report.diagnostics, []);
});

test('runDebugDiagnostics returns a counts object', () => {
  const data = {
    inputBindings: {},
    prefabs: {},
    scenes: [
      {
        key: 'main',
        systems: ['camera'],
        entities: [{ key: 'block', mesh: { shape: 'box' } }]
      }
    ]
  };
  const report = runDebugDiagnostics(data, { schemaResult: { ok: true } });
  assert.equal(report.ran, true);
  assert.equal(report.counts.total, report.diagnostics.length);
  assert.equal(report.counts.error + report.counts.warning, report.counts.total);
});

test('summarizeDiagnostics produces a log-friendly payload', () => {
  const report = {
    ran: true,
    schemaOk: true,
    counts: { error: 1, warning: 2, total: 3 },
    diagnostics: [
      { code: 'A', severity: 'error', message: '' },
      { code: 'B', severity: 'warning', message: '' },
      { code: 'C', severity: 'warning', message: '' }
    ],
    schemaErrorCount: 0,
    normalizationWarningCount: 4
  };
  const summary = summarizeDiagnostics(report);
  assert.equal(summary.normalizationWarningCount, 4);
  assert.deepEqual(summary.diagnostics.codes, ['A', 'B', 'C']);
  assert.equal(summary.diagnostics.total, 3);
});

test('formatDiagnosticsReport prints one line per diagnostic', () => {
  const text = formatDiagnosticsReport({
    schemaOk: true,
    counts: { error: 0, warning: 1, total: 1 },
    normalizationWarningCount: 0,
    diagnostics: [{ severity: 'warning', code: 'UNUSED_ASSET', message: 'unused', jsonPointer: '/assets/0' }]
  });
  assert.match(text, /schemaOk=true/);
  assert.match(text, /\[WARNING\] UNUSED_ASSET/);
});

test('loadSeedProtocol returns the on-disk catalog and includes every emitted code', () => {
  const seed = loadSeedProtocol();
  assert.ok(seed.version >= 1);
  const seededCodes = new Set(seed.entries.map((e) => e.code));
  for (const code of Object.values(DIAGNOSTIC_CODES)) {
    assert.ok(seededCodes.has(code), `seed-protocol.json is missing a catalog entry for ${code}`);
  }
});
