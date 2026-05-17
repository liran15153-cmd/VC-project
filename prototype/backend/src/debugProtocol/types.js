/* ============================================================================
 * Debug Protocol — Core Types & Diagnostic Codes
 * ----------------------------------------------------------------------------
 * Derived from OpenGame (Apache-2.0). See third_party/opengame/NOTICE.
 *   Original: agent-test/debug-skill/src/types.ts
 *   Adaptations: rewritten in CommonJS for LOOMIER's declarative GameDefinition.
 *     Dropped FixType = 'shell' | 'create' | 'delete' (LOOMIER never runs
 *     shell commands or generates files). Replaced FailureStage with stages
 *     that match LOOMIER's pipeline (schema | normalization | preview).
 * ----------------------------------------------------------------------------
 * Stage 1: detection only. No automatic repair, no LLM fallback.
 * ========================================================================= */

'use strict';

const SEVERITY = Object.freeze({
  ERROR: 'error',
  WARNING: 'warning'
});

const FAILURE_STAGE = Object.freeze({
  SCHEMA: 'schema',
  NORMALIZATION: 'normalization',
  RUNTIME: 'runtime',
  PREVIEW: 'preview'
});

/**
 * Catalog of every diagnostic code Stage 1 can emit.
 * Add a code here AND its check in validator.js AND its catalog entry in
 * seed-protocol.json.
 */
const DIAGNOSTIC_CODES = Object.freeze({
  // Camera consistency
  SCENE_HAS_CAMERA_NO_TARGET: 'SCENE_HAS_CAMERA_NO_TARGET',
  CAMERA_TARGET_BUT_NO_CAMERA_SYSTEM: 'CAMERA_TARGET_BUT_NO_CAMERA_SYSTEM',

  // Mesh / model visibility
  ZERO_TRANSFORM_SCALE: 'ZERO_TRANSFORM_SCALE',
  ZERO_MODEL_SCALE: 'ZERO_MODEL_SCALE',
  ZERO_MESH_DIMENSION: 'ZERO_MESH_DIMENSION',

  // Asset consistency (post-normalization)
  DUPLICATE_ASSET_KEY: 'DUPLICATE_ASSET_KEY',
  UNUSED_ASSET: 'UNUSED_ASSET',

  // Behavior / action consistency
  BEHAVIOR_TARGET_MISSING: 'BEHAVIOR_TARGET_MISSING',
  BEHAVIOR_STATE_KEY_MISSING: 'BEHAVIOR_STATE_KEY_MISSING',
  BEHAVIOR_ACTION_UNSUPPORTED: 'BEHAVIOR_ACTION_UNSUPPORTED',

  // Tween consistency
  TWEEN_TARGET_MISSING: 'TWEEN_TARGET_MISSING',

  // Engine-flag vs content mismatches
  THREE_D_DISABLED_BUT_HAS_3D: 'THREE_D_DISABLED_BUT_HAS_3D',
  TWO_D_DISABLED_BUT_HAS_2D: 'TWO_D_DISABLED_BUT_HAS_2D',
  PHYSICS_DISABLED_BUT_RIGIDBODY: 'PHYSICS_DISABLED_BUT_RIGIDBODY',

  // RigidBody quality
  RIGIDBODY_NO_VISUAL: 'RIGIDBODY_NO_VISUAL',
  COLLIDER_DEFAULTED_NO_MESH: 'COLLIDER_DEFAULTED_NO_MESH',

  // Input wiring
  INPUT_BINDINGS_EMPTY_WITH_PLAYER: 'INPUT_BINDINGS_EMPTY_WITH_PLAYER',

  // Playability contract
  INITIAL_SCENE_NOT_PLAYABLE: 'INITIAL_SCENE_NOT_PLAYABLE',
  PLAYABLE_SCENE_NO_PLAYER: 'PLAYABLE_SCENE_NO_PLAYER',
  PLAYABLE_SCENE_NO_GROUND_COLLIDER: 'PLAYABLE_SCENE_NO_GROUND_COLLIDER',
  PLAYABLE_SCENE_NO_BEHAVIOR_RULES: 'PLAYABLE_SCENE_NO_BEHAVIOR_RULES'
});

/**
 * Build a diagnostic record. Every field except code / severity / message is
 * optional, but suggestedFixText is *strongly* encouraged.
 *
 * @param {object} input
 * @param {string} input.code               One of DIAGNOSTIC_CODES.
 * @param {string} input.severity           'error' | 'warning'.
 * @param {string} input.message            Human-readable description.
 * @param {string} [input.jsonPointer]      RFC 6901 pointer into the definition.
 * @param {*}      [input.expected]         What the value should have been.
 * @param {*}      [input.actual]           What the value actually is.
 * @param {string} [input.suggestedFixText] Human-readable fix advice.
 *                                          Not an executable patch.
 */
function createDiagnostic({
  code,
  severity,
  message,
  jsonPointer = '',
  expected = undefined,
  actual = undefined,
  suggestedFixText = ''
}) {
  if (!code) throw new Error('createDiagnostic: code is required');
  if (severity !== SEVERITY.ERROR && severity !== SEVERITY.WARNING) {
    throw new Error(`createDiagnostic: severity must be 'error' or 'warning', got "${severity}"`);
  }
  if (!message) throw new Error('createDiagnostic: message is required');
  return {
    code,
    severity,
    message,
    jsonPointer,
    expected,
    actual,
    suggestedFixText
  };
}

module.exports = {
  SEVERITY,
  FAILURE_STAGE,
  DIAGNOSTIC_CODES,
  createDiagnostic
};
