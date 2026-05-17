/* ============================================================================
 * Stage 2B — Repair loop integration tests
 * ----------------------------------------------------------------------------
 * Exercises tryRepairAndValidate against full GameDefinition objects that
 * exercise the four scenarios specified in Stage 2B:
 *
 *   Case A: model returns valid schema but a ZERO_TRANSFORM_SCALE diagnostic.
 *           Repair applies, final GameDefinition has scale fixed, debugRepair
 *           reports accepted with patches.
 *
 *   Case B: model returns BEHAVIOR_TARGET_MISSING. No repair is applied, the
 *           diagnostic stays in debugDiagnostics, no entity is invented.
 *
 *   Case C: model returns one repairable + one non-repairable diagnostic.
 *           Only the repairable one is patched. The non-repairable one remains
 *           visible to the caller.
 *
 *   Case D: repair returns a candidate that fails re-validation. The repair
 *           loop must reject it and fall back to the original (non-repaired)
 *           validation result with debugRepair.accepted === false.
 * ========================================================================= */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'fatal';

const {
  validateGeneratedGameDefinition,
  tryRepairAndValidate
} = require('../src/services/engineGenerationService');
const { DIAGNOSTIC_CODES } = require('../src/debugProtocol/types');

// ─── Fixture builders ──────────────────────────────────────────────────────

function baseValidDefinition() {
  return {
    schemaVersion: 1,
    metadata: { title: 'Repair Integration Test', genre: 'platformer' },
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

// ───────────────────────────────────────────────────────────────────────────
// CASE A: ZERO_TRANSFORM_SCALE — repair applies, accepted
// ───────────────────────────────────────────────────────────────────────────

test('Case A: ZERO_TRANSFORM_SCALE → repair patches the scale and accepts the result', () => {
  // Schema-valid input where the entity scale has a zero axis.
  const candidate = baseValidDefinition();
  candidate.scenes[0].entities[0].transform.scale = { x: 0, y: 2, z: 3 };

  const initial = validateGeneratedGameDefinition(candidate, []);
  assert.equal(initial.ok, true, 'initial validation must pass (schema accepts 0 scale)');

  // The diagnostic for the zero scale must be present pre-repair.
  const initialDiagCodes = (initial.debugReport?.diagnostics || []).map((d) => d.code);
  assert.ok(initialDiagCodes.includes(DIAGNOSTIC_CODES.ZERO_TRANSFORM_SCALE), `expected ZERO_TRANSFORM_SCALE diagnostic, got: ${initialDiagCodes.join(', ')}`);

  const final = tryRepairAndValidate(initial, []);
  assert.equal(final.ok, true, 'repaired candidate must pass schema');
  assert.equal(final.debugRepair.attempted, true);
  assert.equal(final.debugRepair.accepted, true);
  assert.ok(final.debugRepair.appliedPatches.length > 0, 'must have at least one applied patch');

  // The scale axis was actually patched.
  const finalScale = final.data.scenes[0].entities[0].transform.scale;
  assert.equal(finalScale.x, 1, 'zero x axis should now be 1');
  assert.equal(finalScale.y, 2, 'non-zero y axis preserved');
  assert.equal(finalScale.z, 3, 'non-zero z axis preserved');

  // The repairable diagnostic is gone from the final report.
  const finalDiagCodes = (final.debugReport?.diagnostics || []).map((d) => d.code);
  assert.ok(!finalDiagCodes.includes(DIAGNOSTIC_CODES.ZERO_TRANSFORM_SCALE), 'ZERO_TRANSFORM_SCALE should be cleared after repair');
});

// ───────────────────────────────────────────────────────────────────────────
// CASE B: BEHAVIOR_TARGET_MISSING — diagnostic stays, nothing invented
// ───────────────────────────────────────────────────────────────────────────

test('Case B: BEHAVIOR_TARGET_MISSING → not repaired, diagnostic persists, no entity invented', () => {
  const candidate = baseValidDefinition();
  candidate.scenes[0].behaviors = [
    {
      trigger: 'sceneStart',
      actions: [{ type: 'applyImpulse', target: 'ghost_entity_does_not_exist', value: { x: 0, y: 1, z: 0 } }]
    }
  ];

  const initial = validateGeneratedGameDefinition(candidate, []);
  assert.equal(initial.ok, true);

  const initialCodes = (initial.debugReport?.diagnostics || []).map((d) => d.code);
  assert.ok(initialCodes.includes(DIAGNOSTIC_CODES.BEHAVIOR_TARGET_MISSING), `expected BEHAVIOR_TARGET_MISSING, got: ${initialCodes.join(', ')}`);

  const final = tryRepairAndValidate(initial, []);

  // No repair attempted because the diagnostic is not in REPAIRABLE_CODES.
  assert.equal(final.debugRepair.attempted, false, 'must not attempt repair for non-repairable diagnostics');
  assert.equal(final.debugRepair.accepted, false);
  assert.deepEqual(final.debugRepair.appliedPatches, []);

  // The diagnostic stays in the final report — caller sees it.
  const finalCodes = (final.debugReport?.diagnostics || []).map((d) => d.code);
  assert.ok(finalCodes.includes(DIAGNOSTIC_CODES.BEHAVIOR_TARGET_MISSING), 'BEHAVIOR_TARGET_MISSING must remain visible to the caller');

  // Critically: no entity was invented in scenes or prefabs.
  const sceneEntityKeys = final.data.scenes.flatMap((s) => s.entities.map((e) => e.key));
  const prefabKeys = Object.keys(final.data.prefabs || {});
  assert.ok(!sceneEntityKeys.includes('ghost_entity_does_not_exist'), 'repairer must NOT invent entities');
  assert.ok(!prefabKeys.includes('ghost_entity_does_not_exist'), 'repairer must NOT invent prefabs');

  // The behavior's bogus target is preserved verbatim — repair does not silently mutate it.
  const action = final.data.scenes[0].behaviors[0].actions[0];
  assert.equal(action.target, 'ghost_entity_does_not_exist', 'target string must be preserved');
});

// ───────────────────────────────────────────────────────────────────────────
// CASE C: Mixed diagnostics — only repairable is patched
// ───────────────────────────────────────────────────────────────────────────

test('Case C: mixed repairable + non-repairable → only repairable is patched, non-repairable persists', () => {
  const candidate = baseValidDefinition();
  // Repairable: zero mesh dimension on the player.
  candidate.scenes[0].entities[0].mesh.size = { x: 1, y: 0, z: 1 };
  // Non-repairable: tween targeting a missing entity.
  candidate.scenes[0].animations = [
    { target: 'phantom', property: 'position.x', from: 0, to: 1 }
  ];

  const initial = validateGeneratedGameDefinition(candidate, []);
  assert.equal(initial.ok, true);

  const initialCodes = (initial.debugReport?.diagnostics || []).map((d) => d.code);
  assert.ok(initialCodes.includes(DIAGNOSTIC_CODES.ZERO_MESH_DIMENSION), 'expected ZERO_MESH_DIMENSION pre-repair');
  assert.ok(initialCodes.includes(DIAGNOSTIC_CODES.TWEEN_TARGET_MISSING), 'expected TWEEN_TARGET_MISSING pre-repair');

  const final = tryRepairAndValidate(initial, []);
  assert.equal(final.ok, true);
  assert.equal(final.debugRepair.attempted, true);
  assert.equal(final.debugRepair.accepted, true);

  // Repairable was patched.
  const patchCodes = final.debugRepair.appliedPatches.map((p) => p.diagnosticCode);
  assert.ok(patchCodes.includes(DIAGNOSTIC_CODES.ZERO_MESH_DIMENSION), 'ZERO_MESH_DIMENSION should be in applied patches');
  assert.ok(!patchCodes.includes(DIAGNOSTIC_CODES.TWEEN_TARGET_MISSING), 'TWEEN_TARGET_MISSING should NOT be in applied patches');

  // Skip-count reflects the non-repairable diagnostic.
  assert.ok(final.debugRepair.skippedCount >= 1, 'at least one diagnostic should be skipped');

  // Mesh size is now valid.
  const meshSize = final.data.scenes[0].entities[0].mesh.size;
  assert.equal(meshSize.y, 1, 'mesh size y axis was 0, repaired to 1');

  // Non-repairable diagnostic still visible in the final report.
  const finalCodes = (final.debugReport?.diagnostics || []).map((d) => d.code);
  assert.ok(finalCodes.includes(DIAGNOSTIC_CODES.TWEEN_TARGET_MISSING), 'TWEEN_TARGET_MISSING must remain in the final diagnostics');
  assert.ok(!finalCodes.includes(DIAGNOSTIC_CODES.ZERO_MESH_DIMENSION), 'ZERO_MESH_DIMENSION should be cleared');
});

// ───────────────────────────────────────────────────────────────────────────
// CASE D: repair returns schema-invalid candidate → rejected, fall back
// ───────────────────────────────────────────────────────────────────────────

test('Case D: repair produces schema-invalid candidate → rejected, original returned', () => {
  // Start from a schema-valid candidate with a repairable diagnostic.
  const candidate = baseValidDefinition();
  candidate.scenes[0].entities[0].transform.scale = { x: 0, y: 1, z: 1 };

  const initial = validateGeneratedGameDefinition(candidate, []);
  assert.equal(initial.ok, true);

  // Inject a malicious "repair" function that deletes a required field,
  // making the repaired candidate fail schema validation.
  const maliciousRepair = (definition /* diagnostics */) => {
    const cloned = JSON.parse(JSON.stringify(definition));
    // Break schema: remove metadata.title (required by schema)
    delete cloned.metadata.title;
    return {
      repairedGameDefinition: cloned,
      appliedPatches: [{
        op: 'replace',
        path: '/metadata',
        value: cloned.metadata,
        reason: 'TEST: intentionally invalid patch to verify rejection',
        diagnosticCode: DIAGNOSTIC_CODES.ZERO_TRANSFORM_SCALE
      }],
      skippedDiagnostics: [],
      remainingDiagnostics: [],
      changed: true
    };
  };

  const final = tryRepairAndValidate(initial, [], { repair: maliciousRepair });

  // Repair attempted but NOT accepted.
  assert.equal(final.debugRepair.attempted, true, 'repair was attempted');
  assert.equal(final.debugRepair.accepted, false, 'malicious repair must be rejected');

  // The data returned is the ORIGINAL (zero-scale) candidate, not the broken one.
  assert.equal(final.ok, true, 'final must still be ok=true (using the original validated data)');
  assert.equal(final.data.scenes[0].entities[0].transform.scale.x, 0, 'original zero-scale data is returned, not the broken patched version');
  assert.ok(final.data.metadata?.title, 'metadata.title must still be present (we did NOT use the broken patch)');

  // Diagnostics still report the unfixed issue.
  const finalCodes = (final.debugReport?.diagnostics || []).map((d) => d.code);
  assert.ok(finalCodes.includes(DIAGNOSTIC_CODES.ZERO_TRANSFORM_SCALE), 'unrepaired diagnostic still visible');
});

// ───────────────────────────────────────────────────────────────────────────
// Additional safety: existing valid definition stays unchanged
// ───────────────────────────────────────────────────────────────────────────

test('repair loop is a no-op when no repairable diagnostics exist', () => {
  const initial = validateGeneratedGameDefinition(baseValidDefinition(), []);
  assert.equal(initial.ok, true);
  const final = tryRepairAndValidate(initial, []);
  assert.equal(final.debugRepair.attempted, false);
  assert.equal(final.debugRepair.accepted, false);
  assert.deepEqual(final.debugRepair.appliedPatches, []);
  // Final data is the same reference (or at least the same shape) as initial.
  assert.equal(final.data.scenes[0].entities[0].transform.scale.x, 1);
});

// ───────────────────────────────────────────────────────────────────────────
// Hard cap: repair loop must stop at MAX_REPAIR_ITERATIONS
// ───────────────────────────────────────────────────────────────────────────

test('repair loop respects the hard iteration cap', () => {
  // Inject a repair that always claims to apply patches but never actually
  // fixes the diagnostic. The loop must terminate after MAX_REPAIR_ITERATIONS.
  const candidate = baseValidDefinition();
  candidate.scenes[0].entities[0].transform.scale = { x: 0, y: 1, z: 1 };

  const initial = validateGeneratedGameDefinition(candidate, []);
  assert.equal(initial.ok, true);

  let callCount = 0;
  const stubbornRepair = (definition /* diagnostics */) => {
    callCount += 1;
    // Return the same broken definition (zero scale stays zero) with a fake patch
    // claim. Each iteration re-validates and finds the diagnostic still present.
    const cloned = JSON.parse(JSON.stringify(definition));
    return {
      repairedGameDefinition: cloned, // unchanged — diagnostic will persist
      appliedPatches: [{
        op: 'replace',
        path: '/scenes/0/entities/0/transform/scale/x',
        value: 0, // "patch" that doesn't actually fix anything
        reason: 'TEST: stubborn no-op patch',
        diagnosticCode: DIAGNOSTIC_CODES.ZERO_TRANSFORM_SCALE
      }],
      skippedDiagnostics: [],
      remainingDiagnostics: [],
      changed: true
    };
  };

  const final = tryRepairAndValidate(initial, [], { repair: stubbornRepair });

  // Must stop at MAX_REPAIR_ITERATIONS (= 3).
  assert.ok(callCount <= 3, `repair must be called at most 3 times, was called ${callCount}`);
  assert.equal(final.debugRepair.accepted, false, 'stubborn repair must not be accepted');
});
