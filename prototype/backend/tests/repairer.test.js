'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'fatal';

const { repairGameDefinition, REPAIRABLE_CODES, MAX_REPAIR_ITERATIONS } = require('../src/debugProtocol/repairer');
const { runAllChecks } = require('../src/debugProtocol/validator');
const { DIAGNOSTIC_CODES } = require('../src/debugProtocol/types');
const { validateEngineGameDefinitionSafe } = require('../src/schemas/engineGameDefinitionSchema');

// ─── Fixtures ──────────────────────────────────────────────────────────────

function minimalValid() {
  return {
    schemaVersion: 1,
    metadata: { title: 'Repair Test', genre: 'platformer' },
    engine: { enable3D: true, enable2D: false, enablePhysics: true },
    scenes: [
      {
        key: 'main',
        systems: ['physicsSync', 'camera'],
        entities: [
          {
            key: 'player',
            transform: { position: { x: 0, y: 1, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
            mesh: { shape: 'box', size: { x: 1, y: 1, z: 1 } },
            rigidBody: { type: 'dynamic', collider: { shape: 'cuboid', halfExtents: { x: 0.5, y: 0.5, z: 0.5 } } },
            cameraTarget: { lerp: 5, offset: { x: 0, y: 4, z: 8 } }
          }
        ]
      }
    ],
    initialScene: 'main'
  };
}

function validate(def) {
  const result = validateEngineGameDefinitionSafe(def);
  if (!result.ok) throw new Error(`fixture failed schema: ${result.errors.map((e) => e.message).join('; ')}`);
  return result.data;
}

// ─── ZERO_TRANSFORM_SCALE ──────────────────────────────────────────────────

test('ZERO_TRANSFORM_SCALE: patches x=0 to 1, preserves non-zero axes', () => {
  const data = validate({
    ...minimalValid(),
    scenes: [{
      key: 'main',
      systems: ['physicsSync', 'camera'],
      entities: [{
        key: 'ghost',
        transform: { scale: { x: 0, y: 2, z: 3 } },
        mesh: { shape: 'box', size: { x: 1, y: 1, z: 1 } },
        cameraTarget: {}
      }]
    }]
  });
  const diagnostics = runAllChecks(data);
  const result = repairGameDefinition(data, diagnostics);
  assert.equal(result.changed, true);
  const patchedScale = result.repairedGameDefinition.scenes[0].entities[0].transform.scale;
  assert.equal(patchedScale.x, 1, 'zero x should become 1');
  assert.equal(patchedScale.y, 2, 'non-zero y must be preserved');
  assert.equal(patchedScale.z, 3, 'non-zero z must be preserved');
  assert.ok(result.appliedPatches.some((p) => p.diagnosticCode === DIAGNOSTIC_CODES.ZERO_TRANSFORM_SCALE && p.path.endsWith('/x')));
});

test('ZERO_TRANSFORM_SCALE: all three axes can be repaired', () => {
  const data = validate({
    ...minimalValid(),
    scenes: [{
      key: 'main',
      systems: ['physicsSync'],
      entities: [{ key: 'e', transform: { scale: { x: 0, y: 0, z: 0 } }, mesh: { shape: 'box' } }]
    }]
  });
  const diagnostics = runAllChecks(data);
  const result = repairGameDefinition(data, diagnostics);
  const scale = result.repairedGameDefinition.scenes[0].entities[0].transform.scale;
  assert.deepEqual(scale, { x: 1, y: 1, z: 1 });
  assert.equal(result.appliedPatches.filter((p) => p.diagnosticCode === DIAGNOSTIC_CODES.ZERO_TRANSFORM_SCALE).length, 3);
});

test('ZERO_TRANSFORM_SCALE: entity without visual is not patched', () => {
  // No mesh/model/sprite → validator does not fire → no patch
  const data = validate({
    ...minimalValid(),
    scenes: [{
      key: 'main',
      systems: ['physicsSync', 'camera'],
      entities: [
        { key: 'wall', transform: { scale: { x: 0, y: 1, z: 1 } }, rigidBody: { type: 'static', collider: { shape: 'cuboid', halfExtents: { x: 1, y: 1, z: 1 } } } },
        { key: 'player', transform: { scale: { x: 1, y: 1, z: 1 } }, mesh: { shape: 'box' }, cameraTarget: {} }
      ]
    }]
  });
  const diagnostics = runAllChecks(data);
  const result = repairGameDefinition(data, diagnostics);
  // 'wall' has zero x-scale but no visual — ZERO_TRANSFORM_SCALE should not fire for it
  const wallScale = result.repairedGameDefinition.scenes[0].entities[0].transform.scale;
  assert.equal(wallScale.x, 0, 'non-visual entity scale must not be changed');
});

// ─── ZERO_MODEL_SCALE ──────────────────────────────────────────────────────

test('ZERO_MODEL_SCALE: patches model.scale zeros to 1', () => {
  const data = validate({
    ...minimalValid(),
    assets: [{ key: 'hero', type: 'gltf', url: '/assets/hero.glb' }],
    scenes: [{
      key: 'main',
      systems: ['physicsSync', 'camera'],
      entities: [{
        key: 'player',
        model: { assetKey: 'hero', scale: { x: 0, y: 1, z: 1 } },
        cameraTarget: {}
      }]
    }]
  });
  const diagnostics = runAllChecks(data);
  const result = repairGameDefinition(data, diagnostics);
  assert.equal(result.changed, true);
  const scale = result.repairedGameDefinition.scenes[0].entities[0].model.scale;
  assert.equal(scale.x, 1);
  assert.equal(scale.y, 1);
  assert.ok(result.appliedPatches.some((p) => p.diagnosticCode === DIAGNOSTIC_CODES.ZERO_MODEL_SCALE));
});

// ─── ZERO_MESH_DIMENSION ───────────────────────────────────────────────────

test('ZERO_MESH_DIMENSION: patches mesh.size zeros to 1', () => {
  const data = validate({
    ...minimalValid(),
    scenes: [{
      key: 'main',
      systems: ['physicsSync', 'camera'],
      entities: [{
        key: 'floor',
        mesh: { shape: 'box', size: { x: 10, y: 0, z: 5 } },
        cameraTarget: {}
      }]
    }]
  });
  const diagnostics = runAllChecks(data);
  const result = repairGameDefinition(data, diagnostics);
  assert.equal(result.changed, true);
  const size = result.repairedGameDefinition.scenes[0].entities[0].mesh.size;
  assert.equal(size.x, 10, 'non-zero x preserved');
  assert.equal(size.y, 1, 'zero y patched to 1');
  assert.equal(size.z, 5, 'non-zero z preserved');
  assert.ok(result.appliedPatches.some((p) => p.diagnosticCode === DIAGNOSTIC_CODES.ZERO_MESH_DIMENSION && p.path.endsWith('/y')));
});

// ─── CAMERA_TARGET_BUT_NO_CAMERA_SYSTEM ───────────────────────────────────

test('CAMERA_TARGET_BUT_NO_CAMERA_SYSTEM: adds camera to scene.systems', () => {
  const data = validate({
    ...minimalValid(),
    scenes: [{
      key: 'main',
      systems: ['physicsSync'],
      entities: [
        { key: 'player', mesh: { shape: 'box' }, cameraTarget: {} }
      ]
    }]
  });
  const diagnostics = runAllChecks(data);
  assert.ok(diagnostics.some((d) => d.code === DIAGNOSTIC_CODES.CAMERA_TARGET_BUT_NO_CAMERA_SYSTEM));
  const result = repairGameDefinition(data, diagnostics);
  assert.equal(result.changed, true);
  const systems = result.repairedGameDefinition.scenes[0].systems;
  assert.ok(systems.includes('camera'), 'camera must be added to systems');
  assert.ok(systems.includes('physicsSync'), 'existing systems must be preserved');
  assert.ok(result.appliedPatches.some((p) => p.diagnosticCode === DIAGNOSTIC_CODES.CAMERA_TARGET_BUT_NO_CAMERA_SYSTEM));
});

test('CAMERA_TARGET_BUT_NO_CAMERA_SYSTEM: does not duplicate "camera" if already present', () => {
  const data = validate(minimalValid()); // already has camera system
  const diagnostics = runAllChecks(data);
  const result = repairGameDefinition(data, diagnostics);
  const cameraSystems = result.repairedGameDefinition.scenes[0].systems.filter((s) => s === 'camera');
  assert.equal(cameraSystems.length, 1, 'camera must not be duplicated');
});

// ─── PHYSICS_DISABLED_BUT_RIGIDBODY ───────────────────────────────────────

test('PHYSICS_DISABLED_BUT_RIGIDBODY: sets engine.enablePhysics = true', () => {
  // Bypass normalization by calling repairGameDefinition directly on synthetic data
  const data = {
    engine: { enable3D: true, enable2D: false, enablePhysics: false },
    prefabs: {},
    scenes: [{
      key: 'main',
      systems: ['physicsSync'],
      entities: [{
        key: 'player',
        mesh: { shape: 'box', size: { x: 1, y: 1, z: 1 } },
        rigidBody: { type: 'dynamic', collider: { shape: 'cuboid', halfExtents: { x: 0.5, y: 0.5, z: 0.5 } } }
      }]
    }]
  };
  // Produce the diagnostic manually (normalization would auto-fix, so we bypass it)
  const diagnostics = [
    { code: DIAGNOSTIC_CODES.PHYSICS_DISABLED_BUT_RIGIDBODY, severity: 'warning', message: 'test', jsonPointer: '/engine/enablePhysics' }
  ];
  const result = repairGameDefinition(data, diagnostics);
  assert.equal(result.changed, true);
  assert.equal(result.repairedGameDefinition.engine.enablePhysics, true);
  assert.ok(result.appliedPatches.some((p) => p.diagnosticCode === DIAGNOSTIC_CODES.PHYSICS_DISABLED_BUT_RIGIDBODY && p.path === '/engine/enablePhysics'));
});

test('PHYSICS_DISABLED_BUT_RIGIDBODY: no-op when enablePhysics is not false', () => {
  const data = { engine: { enablePhysics: true }, prefabs: {}, scenes: [{ key: 'main', entities: [{ key: 'e', rigidBody: {} }] }] };
  const diagnostics = [{ code: DIAGNOSTIC_CODES.PHYSICS_DISABLED_BUT_RIGIDBODY, severity: 'warning', message: 'test' }];
  const result = repairGameDefinition(data, diagnostics);
  assert.equal(result.changed, false);
});

// ─── Codes that must NOT be repaired ──────────────────────────────────────

test('DUPLICATE_ASSET_KEY is skipped (not in Stage 2A repairable set)', () => {
  const diagnostics = [{ code: DIAGNOSTIC_CODES.DUPLICATE_ASSET_KEY, severity: 'error', message: 'dup' }];
  const result = repairGameDefinition(minimalValid(), diagnostics);
  assert.equal(result.changed, false);
  assert.ok(result.skippedDiagnostics.some((s) => s.code === DIAGNOSTIC_CODES.DUPLICATE_ASSET_KEY));
});

test('UNUSED_ASSET is skipped', () => {
  const diagnostics = [{ code: DIAGNOSTIC_CODES.UNUSED_ASSET, severity: 'warning', message: 'unused' }];
  const result = repairGameDefinition(minimalValid(), diagnostics);
  assert.equal(result.changed, false);
  assert.ok(result.skippedDiagnostics.some((s) => s.code === DIAGNOSTIC_CODES.UNUSED_ASSET));
});

test('BEHAVIOR_TARGET_MISSING is skipped', () => {
  const diagnostics = [{ code: DIAGNOSTIC_CODES.BEHAVIOR_TARGET_MISSING, severity: 'warning', message: 'no entity' }];
  const result = repairGameDefinition(minimalValid(), diagnostics);
  assert.equal(result.changed, false);
  assert.ok(result.skippedDiagnostics.some((s) => s.code === DIAGNOSTIC_CODES.BEHAVIOR_TARGET_MISSING));
});

test('RIGIDBODY_NO_VISUAL is skipped', () => {
  const diagnostics = [{ code: DIAGNOSTIC_CODES.RIGIDBODY_NO_VISUAL, severity: 'warning', message: 'no visual' }];
  const result = repairGameDefinition(minimalValid(), diagnostics);
  assert.equal(result.changed, false);
});

test('TWEEN_TARGET_MISSING is skipped', () => {
  const diagnostics = [{ code: DIAGNOSTIC_CODES.TWEEN_TARGET_MISSING, severity: 'warning', message: 'no entity' }];
  const result = repairGameDefinition(minimalValid(), diagnostics);
  assert.equal(result.changed, false);
});

test('SCENE_HAS_CAMERA_NO_TARGET is skipped', () => {
  const diagnostics = [{ code: DIAGNOSTIC_CODES.SCENE_HAS_CAMERA_NO_TARGET, severity: 'warning', message: 'no target' }];
  const result = repairGameDefinition(minimalValid(), diagnostics);
  assert.equal(result.changed, false);
});

// ─── No mutation guarantee ────────────────────────────────────────────────

test('repair does not mutate the original input object', () => {
  const data = validate({
    ...minimalValid(),
    scenes: [{
      key: 'main',
      systems: ['physicsSync'],
      entities: [{ key: 'e', transform: { scale: { x: 0, y: 1, z: 1 } }, mesh: { shape: 'box' } }]
    }]
  });
  const originalScale = data.scenes[0].entities[0].transform.scale.x;
  const diagnostics = runAllChecks(data);
  repairGameDefinition(data, diagnostics);
  assert.equal(data.scenes[0].entities[0].transform.scale.x, originalScale, 'original must not be mutated');
});

// ─── Schema validation after repair ───────────────────────────────────────

test('repaired output passes schema validation', () => {
  const data = validate({
    ...minimalValid(),
    scenes: [{
      key: 'main',
      systems: ['physicsSync', 'camera'],
      entities: [{
        key: 'hero',
        transform: { scale: { x: 0, y: 0, z: 0 } },
        mesh: { shape: 'box', size: { x: 0, y: 0, z: 0 } },
        cameraTarget: {}
      }]
    }]
  });
  const diagnostics = runAllChecks(data);
  const result = repairGameDefinition(data, diagnostics);
  assert.equal(result.changed, true);
  const check = validateEngineGameDefinitionSafe(result.repairedGameDefinition);
  assert.equal(check.ok, true, `repaired definition must pass schema: ${JSON.stringify(check.errors)}`);
});

// ─── Valid definition remains unchanged ───────────────────────────────────

test('existing valid GameDefinition with no diagnostics is not modified', () => {
  const data = validate(minimalValid());
  const diagnostics = runAllChecks(data);
  const result = repairGameDefinition(data, diagnostics);
  // minimalValid() may produce warnings (UNUSED_ASSET, etc.) but no repairable ones
  const repairableCount = diagnostics.filter((d) => REPAIRABLE_CODES.has(d.code)).length;
  assert.equal(repairableCount, 0, `expected no repairable diagnostics: ${diagnostics.map((d) => d.code).join(', ')}`);
  assert.equal(result.changed, false);
  assert.deepEqual(result.appliedPatches, []);
});

// ─── MAX_REPAIR_ITERATIONS constant ───────────────────────────────────────

test('MAX_REPAIR_ITERATIONS is exported and is a positive integer', () => {
  assert.ok(typeof MAX_REPAIR_ITERATIONS === 'number' && Number.isInteger(MAX_REPAIR_ITERATIONS) && MAX_REPAIR_ITERATIONS > 0);
  assert.equal(MAX_REPAIR_ITERATIONS, 3);
});

test('REPAIRABLE_CODES is a Set containing exactly the Stage 2A codes', () => {
  assert.ok(REPAIRABLE_CODES instanceof Set);
  const expected = new Set([
    DIAGNOSTIC_CODES.ZERO_TRANSFORM_SCALE,
    DIAGNOSTIC_CODES.ZERO_MODEL_SCALE,
    DIAGNOSTIC_CODES.ZERO_MESH_DIMENSION,
    DIAGNOSTIC_CODES.CAMERA_TARGET_BUT_NO_CAMERA_SYSTEM,
    DIAGNOSTIC_CODES.PHYSICS_DISABLED_BUT_RIGIDBODY
  ]);
  for (const code of expected) {
    assert.ok(REPAIRABLE_CODES.has(code), `REPAIRABLE_CODES must include ${code}`);
  }
  // Codes that must NOT be in the set
  const forbidden = [
    DIAGNOSTIC_CODES.DUPLICATE_ASSET_KEY,
    DIAGNOSTIC_CODES.UNUSED_ASSET,
    DIAGNOSTIC_CODES.RIGIDBODY_NO_VISUAL,
    DIAGNOSTIC_CODES.BEHAVIOR_TARGET_MISSING,
    DIAGNOSTIC_CODES.TWEEN_TARGET_MISSING,
    DIAGNOSTIC_CODES.SCENE_HAS_CAMERA_NO_TARGET
  ];
  for (const code of forbidden) {
    assert.ok(!REPAIRABLE_CODES.has(code), `REPAIRABLE_CODES must NOT include ${code}`);
  }
});

// ─── No-op on empty diagnostics ───────────────────────────────────────────

test('no diagnostics → no changes, no patches', () => {
  const result = repairGameDefinition(minimalValid(), []);
  assert.equal(result.changed, false);
  assert.deepEqual(result.appliedPatches, []);
  assert.deepEqual(result.skippedDiagnostics, []);
});

// ─── Mixed repairable + non-repairable ────────────────────────────────────

test('mixed diagnostics: repairable ones fixed, non-repairable ones skipped', () => {
  const data = validate({
    ...minimalValid(),
    scenes: [{
      key: 'main',
      systems: ['physicsSync'],
      entities: [{ key: 'e', transform: { scale: { x: 0, y: 1, z: 1 } }, mesh: { shape: 'box' } }]
    }]
  });
  const diagnostics = [
    ...runAllChecks(data),
    { code: DIAGNOSTIC_CODES.UNUSED_ASSET, severity: 'warning', message: 'orphan' }
  ];
  const result = repairGameDefinition(data, diagnostics);
  assert.equal(result.changed, true);
  assert.ok(result.appliedPatches.some((p) => p.diagnosticCode === DIAGNOSTIC_CODES.ZERO_TRANSFORM_SCALE));
  assert.ok(result.skippedDiagnostics.some((s) => s.code === DIAGNOSTIC_CODES.UNUSED_ASSET));
});

// ─── Patch record shape ───────────────────────────────────────────────────

test('each patch record has required fields', () => {
  const data = validate({
    ...minimalValid(),
    scenes: [{
      key: 'main',
      systems: ['physicsSync', 'camera'],
      entities: [{ key: 'e', transform: { scale: { x: 0, y: 1, z: 1 } }, mesh: { shape: 'box' }, cameraTarget: {} }]
    }]
  });
  const diagnostics = runAllChecks(data);
  const result = repairGameDefinition(data, diagnostics);
  for (const patch of result.appliedPatches) {
    assert.ok(patch.op === 'replace' || patch.op === 'add', `invalid op: ${patch.op}`);
    assert.ok(typeof patch.path === 'string' && patch.path.startsWith('/'), `invalid path: ${patch.path}`);
    assert.ok(typeof patch.reason === 'string' && patch.reason.length > 0);
    assert.ok(typeof patch.diagnosticCode === 'string' && patch.diagnosticCode.length > 0);
  }
});
