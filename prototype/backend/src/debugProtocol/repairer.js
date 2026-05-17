/* ============================================================================
 * Debug Protocol — Stage 2A Deterministic Repairer
 * ----------------------------------------------------------------------------
 * Applies safe, conservative JSON patches to fix a narrow set of technical
 * GameDefinition issues that can be resolved without any LLM call.
 *
 * Design constraints:
 *   - Never mutates the input definition.
 *   - Never invents new assets, entities, scene keys, behavior targets, or
 *     gameplay logic.
 *   - Every patch records its path, old context, and reason for auditing.
 *   - Caller MUST re-validate with schema + diagnostics after each iteration.
 *   - Returns a result object; the caller decides whether to accept or reject.
 *
 * Repairable codes (Stage 2A):
 *   ZERO_TRANSFORM_SCALE          → replace 0 axes with 1 (visibility fix)
 *   ZERO_MODEL_SCALE              → replace 0 axes with 1 (visibility fix)
 *   ZERO_MESH_DIMENSION           → replace 0 axes with 1 (visibility fix)
 *   CAMERA_TARGET_BUT_NO_CAMERA_SYSTEM → add "camera" to scene.systems
 *   PHYSICS_DISABLED_BUT_RIGIDBODY     → set engine.enablePhysics = true
 *
 * Intentionally NOT repaired in Stage 2A (require human judgment):
 *   DUPLICATE_ASSET_KEY, UNUSED_ASSET, RIGIDBODY_NO_VISUAL,
 *   BEHAVIOR_TARGET_MISSING, TWEEN_TARGET_MISSING,
 *   SCENE_HAS_CAMERA_NO_TARGET, BEHAVIOR_STATE_KEY_MISSING
 * ========================================================================= */

'use strict';

const { DIAGNOSTIC_CODES } = require('./types');

const REPAIRABLE_CODES = Object.freeze(new Set([
  DIAGNOSTIC_CODES.ZERO_TRANSFORM_SCALE,
  DIAGNOSTIC_CODES.ZERO_MODEL_SCALE,
  DIAGNOSTIC_CODES.ZERO_MESH_DIMENSION,
  DIAGNOSTIC_CODES.CAMERA_TARGET_BUT_NO_CAMERA_SYSTEM,
  DIAGNOSTIC_CODES.PHYSICS_DISABLED_BUT_RIGIDBODY
]));

const MAX_REPAIR_ITERATIONS = 3;

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Attempt to fix repairable diagnostics in a GameDefinition.
 *
 * @param {object}   definition   Validated, schema-correct GameDefinition.
 *                                Will NOT be mutated.
 * @param {Array}    diagnostics  Diagnostics from runDebugDiagnostics().
 * @param {object}   [options]    Reserved for future extension.
 * @returns {{
 *   repairedGameDefinition: object,
 *   appliedPatches: Array<PatchRecord>,
 *   skippedDiagnostics: Array<{code: string, reason: string}>,
 *   remainingDiagnostics: Array  -- always []; caller re-validates to fill this
 *   changed: boolean
 * }}
 */
function repairGameDefinition(definition, diagnostics, _options = {}) {
  const candidate = JSON.parse(JSON.stringify(definition)); // deep clone — never mutate input
  const appliedPatches = [];
  const skippedDiagnostics = [];

  // Identify which repairable codes are actually present.
  const codesPresent = new Set();
  for (const d of diagnostics) {
    if (REPAIRABLE_CODES.has(d.code)) {
      codesPresent.add(d.code);
    } else {
      skippedDiagnostics.push({ code: d.code, reason: 'not in Stage 2A repairable set' });
    }
  }

  // Apply one repair handler per code (each handler walks the whole definition).
  for (const code of codesPresent) {
    const patches = applyRepairForCode(candidate, code);
    appliedPatches.push(...patches);
  }

  return {
    repairedGameDefinition: candidate,
    appliedPatches,
    skippedDiagnostics,
    remainingDiagnostics: [], // caller re-runs diagnostics to fill this
    changed: appliedPatches.length > 0
  };
}

// ─── Dispatch ──────────────────────────────────────────────────────────────

function applyRepairForCode(candidate, code) {
  switch (code) {
    case DIAGNOSTIC_CODES.ZERO_TRANSFORM_SCALE:
      return repairZeroTransformScales(candidate);
    case DIAGNOSTIC_CODES.ZERO_MODEL_SCALE:
      return repairZeroModelScales(candidate);
    case DIAGNOSTIC_CODES.ZERO_MESH_DIMENSION:
      return repairZeroMeshDimensions(candidate);
    case DIAGNOSTIC_CODES.CAMERA_TARGET_BUT_NO_CAMERA_SYSTEM:
      return repairCameraTargetWithoutSystem(candidate);
    case DIAGNOSTIC_CODES.PHYSICS_DISABLED_BUT_RIGIDBODY:
      return repairPhysicsDisabled(candidate);
    default:
      return [];
  }
}

// ─── Entity walker ─────────────────────────────────────────────────────────

function collectAllEntityEntries(candidate) {
  const entries = [];
  const scenes = Array.isArray(candidate.scenes) ? candidate.scenes : [];
  for (let s = 0; s < scenes.length; s += 1) {
    const entities = Array.isArray(scenes[s]?.entities) ? scenes[s].entities : [];
    for (let e = 0; e < entities.length; e += 1) {
      entries.push({
        entity: entities[e],
        basePath: `/scenes/${s}/entities/${e}`,
        scene: scenes[s],
        sceneIndex: s,
        entityIndex: e
      });
    }
  }
  const prefabs = candidate.prefabs && typeof candidate.prefabs === 'object' ? candidate.prefabs : {};
  for (const [key, entity] of Object.entries(prefabs)) {
    const esc = key.replace(/~/g, '~0').replace(/\//g, '~1');
    entries.push({ entity, basePath: `/prefabs/${esc}`, scene: null, sceneIndex: -1, entityIndex: -1 });
  }
  return entries;
}

// ─── Scale / dimension fixers ──────────────────────────────────────────────

/**
 * For an already-mutated vec3 object, replace zero axes with 1.
 * Returns patch records (the mutation already happened in-place on the candidate).
 */
function fixZeroAxes(obj, pointerPrefix, diagnosticCode) {
  const patches = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return patches;
  for (const axis of ['x', 'y', 'z']) {
    if (obj[axis] === 0) {
      obj[axis] = 1;
      patches.push({
        op: 'replace',
        path: `${pointerPrefix}/${axis}`,
        value: 1,
        reason: `axis "${axis}" was 0 — entity would be invisible; set to 1`,
        diagnosticCode
      });
    }
  }
  return patches;
}

function repairZeroTransformScales(candidate) {
  const patches = [];
  for (const { entity, basePath } of collectAllEntityEntries(candidate)) {
    if (!entity || typeof entity !== 'object') continue;
    const hasVisual = !!(entity.mesh || entity.model || entity.sprite);
    if (!hasVisual) continue;
    if (entity.transform?.scale && typeof entity.transform.scale === 'object') {
      patches.push(...fixZeroAxes(entity.transform.scale, `${basePath}/transform/scale`, DIAGNOSTIC_CODES.ZERO_TRANSFORM_SCALE));
    }
  }
  return patches;
}

function repairZeroModelScales(candidate) {
  const patches = [];
  for (const { entity, basePath } of collectAllEntityEntries(candidate)) {
    if (!entity?.model) continue;
    if (entity.model.scale && typeof entity.model.scale === 'object') {
      patches.push(...fixZeroAxes(entity.model.scale, `${basePath}/model/scale`, DIAGNOSTIC_CODES.ZERO_MODEL_SCALE));
    }
  }
  return patches;
}

function repairZeroMeshDimensions(candidate) {
  const patches = [];
  for (const { entity, basePath } of collectAllEntityEntries(candidate)) {
    if (!entity?.mesh?.size) continue;
    patches.push(...fixZeroAxes(entity.mesh.size, `${basePath}/mesh/size`, DIAGNOSTIC_CODES.ZERO_MESH_DIMENSION));
  }
  return patches;
}

// ─── Camera system repair ──────────────────────────────────────────────────

function repairCameraTargetWithoutSystem(candidate) {
  const patches = [];
  const scenes = Array.isArray(candidate.scenes) ? candidate.scenes : [];
  for (let s = 0; s < scenes.length; s += 1) {
    const scene = scenes[s];
    if (!scene || typeof scene !== 'object') continue;
    const entities = Array.isArray(scene.entities) ? scene.entities : [];
    const hasCameraTarget = entities.some((e) => e && e.cameraTarget && typeof e.cameraTarget === 'object');
    if (!hasCameraTarget) continue;
    const systems = Array.isArray(scene.systems) ? scene.systems : [];
    if (systems.includes('camera')) continue;
    scene.systems = [...systems, 'camera'];
    patches.push({
      op: 'add',
      path: `/scenes/${s}/systems/-`,
      value: 'camera',
      reason: `scene "${scene.key}" has entities with cameraTarget but was missing the "camera" system; camera will not follow anything without it`,
      diagnosticCode: DIAGNOSTIC_CODES.CAMERA_TARGET_BUT_NO_CAMERA_SYSTEM
    });
  }
  return patches;
}

// ─── Physics flag repair ───────────────────────────────────────────────────

function repairPhysicsDisabled(candidate) {
  const patches = [];
  if (!candidate.engine || candidate.engine.enablePhysics !== false) return patches;
  const allEntities = [
    ...(Array.isArray(candidate.scenes) ? candidate.scenes.flatMap((s) => s?.entities || []) : []),
    ...Object.values(candidate.prefabs || {})
  ];
  if (!allEntities.some((e) => e && e.rigidBody)) return patches;
  candidate.engine.enablePhysics = true;
  patches.push({
    op: 'replace',
    path: '/engine/enablePhysics',
    value: true,
    reason: 'enablePhysics was false but entities with rigidBody exist; physics is required for collisions to work',
    diagnosticCode: DIAGNOSTIC_CODES.PHYSICS_DISABLED_BUT_RIGIDBODY
  });
  return patches;
}

module.exports = {
  repairGameDefinition,
  REPAIRABLE_CODES,
  MAX_REPAIR_ITERATIONS
};
