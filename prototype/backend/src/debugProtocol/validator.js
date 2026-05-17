/* ============================================================================
 * Debug Protocol — Deterministic Validators
 * ----------------------------------------------------------------------------
 * Derived from OpenGame (Apache-2.0). See third_party/opengame/NOTICE.
 *   Original: agent-test/debug-skill/src/validator.ts
 *   Adaptations: OpenGame's validators walk filesystem and grep TypeScript
 *     source files. LOOMIER's validators walk the in-memory GameDefinition
 *     object (already schema-validated and normalized). The *category* of
 *     each check (asset-key consistency, scene-registration consistency,
 *     animation-key consistency) is preserved; the implementations are
 *     pure JS object traversal with no I/O.
 * ----------------------------------------------------------------------------
 * Each check is a pure function of (definition) → Diagnostic[].
 * No filesystem, no network, no LLM, no patching.
 * ========================================================================= */

'use strict';

const {
  SEVERITY,
  DIAGNOSTIC_CODES,
  createDiagnostic
} = require('./types');

// ─── Public entry point ────────────────────────────────────────────────────

/**
 * Run every Stage 1 check on a normalized, schema-validated GameDefinition.
 *
 * @param {object} definition  Output of validateEngineGameDefinitionSafe(...).data
 * @returns {Array<object>}    Diagnostics, possibly empty.
 */
function runAllChecks(definition) {
  if (!definition || typeof definition !== 'object') return [];
  return [
    ...checkCameraConsistency(definition),
    ...checkVisibility(definition),
    ...checkAssetConsistency(definition),
    ...checkBehaviorReferences(definition),
    ...checkTweenReferences(definition),
    ...checkEngineFlagsVsContent(definition),
    ...checkRigidBodyQuality(definition),
    ...checkInputBindings(definition),
    ...checkPlayabilityContract(definition)
  ];
}

// ─── Walkers ───────────────────────────────────────────────────────────────

function eachSceneEntity(definition, callback) {
  const scenes = Array.isArray(definition.scenes) ? definition.scenes : [];
  for (let s = 0; s < scenes.length; s += 1) {
    const scene = scenes[s];
    const entities = Array.isArray(scene?.entities) ? scene.entities : [];
    for (let e = 0; e < entities.length; e += 1) {
      callback(entities[e], scene, `/scenes/${s}/entities/${e}`, s, e);
    }
  }
}

function eachPrefabEntity(definition, callback) {
  const prefabs = definition.prefabs && typeof definition.prefabs === 'object' ? definition.prefabs : {};
  for (const [key, entity] of Object.entries(prefabs)) {
    callback(entity, key, `/prefabs/${escapePointer(key)}`);
  }
}

function escapePointer(segment) {
  return String(segment).replace(/~/g, '~0').replace(/\//g, '~1');
}

function collectAllEntityKeys(definition) {
  const keys = new Set();
  eachSceneEntity(definition, (entity) => {
    if (entity?.key) keys.add(entity.key);
  });
  eachPrefabEntity(definition, (entity, key) => {
    if (entity?.key) keys.add(entity.key);
    if (key) keys.add(key);
  });
  return keys;
}

// ─── Category 1: Camera consistency ────────────────────────────────────────

function checkCameraConsistency(definition) {
  const diagnostics = [];
  const scenes = Array.isArray(definition.scenes) ? definition.scenes : [];

  for (let s = 0; s < scenes.length; s += 1) {
    const scene = scenes[s];
    const systems = Array.isArray(scene?.systems) ? scene.systems : [];
    const hasCameraSystem = systems.includes('camera');
    const entities = Array.isArray(scene?.entities) ? scene.entities : [];
    const cameraTargets = entities.filter((e) => e && e.cameraTarget && typeof e.cameraTarget === 'object');

    if (hasCameraSystem && cameraTargets.length === 0) {
      diagnostics.push(createDiagnostic({
        code: DIAGNOSTIC_CODES.SCENE_HAS_CAMERA_NO_TARGET,
        severity: SEVERITY.WARNING,
        message: `Scene "${scene.key}" enables the camera system but no entity has a cameraTarget. The camera will not follow anything.`,
        jsonPointer: `/scenes/${s}/systems`,
        expected: 'at least one entity in the scene with cameraTarget: {...}',
        actual: 'no entity has cameraTarget',
        suggestedFixText: 'Add cameraTarget: {} to the entity the camera should follow (typically the player). Zod defaults will fill lerp/offset.'
      }));
    }

    if (!hasCameraSystem && cameraTargets.length > 0) {
      for (const target of cameraTargets) {
        const index = entities.indexOf(target);
        diagnostics.push(createDiagnostic({
          code: DIAGNOSTIC_CODES.CAMERA_TARGET_BUT_NO_CAMERA_SYSTEM,
          severity: SEVERITY.WARNING,
          message: `Entity "${target.key}" in scene "${scene.key}" declares cameraTarget but the scene does not include the camera system.`,
          jsonPointer: `/scenes/${s}/entities/${index}/cameraTarget`,
          expected: `scenes[${s}].systems to include "camera"`,
          actual: systems,
          suggestedFixText: `Add "camera" to scenes[${s}].systems, or remove cameraTarget from "${target.key}".`
        }));
      }
    }
  }

  return diagnostics;
}

// ─── Category 2: Mesh/model visibility ─────────────────────────────────────

function isZeroAxis(vec3) {
  if (!vec3 || typeof vec3 !== 'object') return false;
  return vec3.x === 0 || vec3.y === 0 || vec3.z === 0;
}

function checkVisibility(definition) {
  const diagnostics = [];

  const inspect = (entity, pointer) => {
    if (!entity || typeof entity !== 'object') return;

    const hasVisual = !!(entity.mesh || entity.model || entity.sprite);
    if (!hasVisual) return;

    if (entity.transform && isZeroAxis(entity.transform.scale)) {
      diagnostics.push(createDiagnostic({
        code: DIAGNOSTIC_CODES.ZERO_TRANSFORM_SCALE,
        severity: SEVERITY.WARNING,
        message: `Entity "${entity.key || '<unkeyed>'}" has transform.scale with a 0 component; the visual will be invisible.`,
        jsonPointer: `${pointer}/transform/scale`,
        expected: 'every axis of scale to be non-zero',
        actual: entity.transform.scale,
        suggestedFixText: 'Set every axis of transform.scale to a positive number, e.g. { x: 1, y: 1, z: 1 }.'
      }));
    }

    if (entity.model && isZeroAxis(entity.model.scale)) {
      diagnostics.push(createDiagnostic({
        code: DIAGNOSTIC_CODES.ZERO_MODEL_SCALE,
        severity: SEVERITY.WARNING,
        message: `Entity "${entity.key || '<unkeyed>'}" has model.scale with a 0 component; the model will be invisible.`,
        jsonPointer: `${pointer}/model/scale`,
        expected: 'every axis of scale to be non-zero',
        actual: entity.model.scale,
        suggestedFixText: 'Set every axis of model.scale to a positive number.'
      }));
    }

    if (entity.mesh && entity.mesh.size && isZeroAxis(entity.mesh.size)) {
      diagnostics.push(createDiagnostic({
        code: DIAGNOSTIC_CODES.ZERO_MESH_DIMENSION,
        severity: SEVERITY.WARNING,
        message: `Entity "${entity.key || '<unkeyed>'}" has mesh.size with a 0 component; the mesh will be invisible.`,
        jsonPointer: `${pointer}/mesh/size`,
        expected: 'every axis of mesh.size to be a positive number',
        actual: entity.mesh.size,
        suggestedFixText: 'Set every axis of mesh.size to a positive number, e.g. { x: 1, y: 1, z: 1 }.'
      }));
    }
  };

  eachSceneEntity(definition, (entity, _scene, pointer) => inspect(entity, pointer));
  eachPrefabEntity(definition, (entity, _key, pointer) => inspect(entity, pointer));
  return diagnostics;
}

// ─── Category 3: Asset consistency (post-normalization) ────────────────────

function collectAssetReferences(definition) {
  const refs = new Set();
  const visit = (key) => { if (typeof key === 'string' && key) refs.add(key); };

  const visitEntity = (entity) => {
    if (!entity || typeof entity !== 'object') return;
    if (entity.model?.assetKey) visit(entity.model.assetKey);
    if (entity.sprite?.kind === 'image' && entity.sprite.assetKey) visit(entity.sprite.assetKey);
  };

  eachSceneEntity(definition, visitEntity);
  eachPrefabEntity(definition, visitEntity);

  const visitAudio = (rule) => {
    if (!rule || typeof rule !== 'object') return;
    visit(rule.asset);
    visit(rule.sound);
  };
  for (const rule of (definition.audio || [])) visitAudio(rule);
  for (const scene of (definition.scenes || [])) for (const rule of (scene.audio || [])) visitAudio(rule);

  const visitBehaviors = (list) => {
    if (!Array.isArray(list)) return;
    for (const behavior of list) {
      for (const action of (behavior?.actions || [])) {
        if (!action || typeof action !== 'object') continue;
        const type = action.type || action.action;
        if (type === 'playSound') {
          visit(action.asset);
          visit(action.sound);
        }
      }
    }
  };
  visitBehaviors(definition.behaviors);
  for (const scene of (definition.scenes || [])) visitBehaviors(scene?.behaviors);

  return refs;
}

function checkAssetConsistency(definition) {
  const diagnostics = [];
  const assets = Array.isArray(definition.assets) ? definition.assets : [];

  // Duplicate keys
  const seen = new Map(); // key -> first index
  for (let i = 0; i < assets.length; i += 1) {
    const asset = assets[i];
    if (!asset || typeof asset.key !== 'string') continue;
    if (seen.has(asset.key)) {
      diagnostics.push(createDiagnostic({
        code: DIAGNOSTIC_CODES.DUPLICATE_ASSET_KEY,
        severity: SEVERITY.ERROR,
        message: `Asset key "${asset.key}" is declared more than once (at index ${seen.get(asset.key)} and ${i}). Only the first will load.`,
        jsonPointer: `/assets/${i}/key`,
        expected: 'every assets[].key to be unique',
        actual: asset.key,
        suggestedFixText: `Rename the duplicate asset at /assets/${i} or remove it if it is redundant.`
      }));
    } else {
      seen.set(asset.key, i);
    }
  }

  // Unused assets
  const referenced = collectAssetReferences(definition);
  for (let i = 0; i < assets.length; i += 1) {
    const asset = assets[i];
    if (!asset || typeof asset.key !== 'string') continue;
    if (!referenced.has(asset.key)) {
      diagnostics.push(createDiagnostic({
        code: DIAGNOSTIC_CODES.UNUSED_ASSET,
        severity: SEVERITY.WARNING,
        message: `Asset "${asset.key}" is declared but never referenced by any entity, audio rule, or playSound action.`,
        jsonPointer: `/assets/${i}`,
        expected: 'every asset to be referenced at least once',
        actual: 'no references found',
        suggestedFixText: `Either reference "${asset.key}" from an entity (model/sprite) or audio rule, or remove it to keep the bundle lean.`
      }));
    }
  }

  return diagnostics;
}

// ─── Category 4: Behavior / action references ──────────────────────────────

const ACTIONS_WITH_ENTITY_TARGET = new Set([
  'setVelocity',
  'setVelocityX',
  'setVelocityY',
  'setVelocityZ',
  'setPosition',
  'translate',
  'applyImpulse',
  'destroyEntity',
  'addTag',
  'removeTag'
]);

// These targets are resolved at runtime by the engine and are always valid.
// 'collisionOther' / 'collisionSelf' are injected by the collision system.
// 'spawned' is set by the spawner system.
const RUNTIME_ENTITY_REFS = new Set(['collisionOther', 'collisionSelf', 'spawned', 'all']);

const ACTIONS_WITH_STATE_KEY = new Set([
  'setState',
  'incrementState',
  'decrementState'
]);

const SUPPORTED_BEHAVIOR_ACTIONS = new Set([
  'setState',
  'incrementState',
  'decrementState',
  'switchScene',
  'spawnPrefab',
  'destroyEntity',
  'applyImpulse',
  'applyForce',
  'applyTorque',
  'setVelocity',
  'setLinearVelocity',
  'setVelocityX',
  'setVelocityY',
  'setVelocityZ',
  'setAngularVelocity',
  'addKnockback',
  'setPosition',
  'translate',
  'playSound',
  'emitEvent',
  'addTag',
  'removeTag'
]);

function checkBehaviorReferences(definition) {
  const diagnostics = [];
  const entityKeys = collectAllEntityKeys(definition);
  const stateKeys = new Set(Object.keys(definition.state || {}));

  const inspect = (behaviorsList, basePointer) => {
    if (!Array.isArray(behaviorsList)) return;
    for (let b = 0; b < behaviorsList.length; b += 1) {
      const behavior = behaviorsList[b];
      const actions = Array.isArray(behavior?.actions) ? behavior.actions : [];
      for (let a = 0; a < actions.length; a += 1) {
        const action = actions[a];
        if (!action || typeof action !== 'object') continue;
        const type = action.type || action.action;
        const pointer = `${basePointer}/${b}/actions/${a}`;

        if (type && !SUPPORTED_BEHAVIOR_ACTIONS.has(type)) {
          diagnostics.push(createDiagnostic({
            code: DIAGNOSTIC_CODES.BEHAVIOR_ACTION_UNSUPPORTED,
            severity: SEVERITY.WARNING,
            message: `Behavior action "${type}" is not supported by the runtime and will be ignored.`,
            jsonPointer: `${pointer}/type`,
            expected: [...SUPPORTED_BEHAVIOR_ACTIONS].sort(),
            actual: type,
            suggestedFixText: 'Replace this action with a supported action such as setVelocityX, applyImpulse, incrementState, destroyEntity, switchScene, or playSound.'
          }));
        }

        if (typeof action.target === 'string' && ACTIONS_WITH_ENTITY_TARGET.has(type) && !entityKeys.has(action.target) && !RUNTIME_ENTITY_REFS.has(action.target)) {
          diagnostics.push(createDiagnostic({
            code: DIAGNOSTIC_CODES.BEHAVIOR_TARGET_MISSING,
            severity: SEVERITY.WARNING,
            message: `Behavior action "${type}" targets entity "${action.target}" which is not defined in any scene or prefab.`,
            jsonPointer: `${pointer}/target`,
            expected: 'target to match an existing entity.key or prefab key',
            actual: action.target,
            suggestedFixText: `Add an entity with key "${action.target}" to a scene, add a prefab with that key, or fix the typo.`
          }));
        }

        const stateKey = typeof action.stateKey === 'string' ? action.stateKey : (typeof action.key === 'string' ? action.key : null);
        if (stateKey && ACTIONS_WITH_STATE_KEY.has(type) && !stateKeys.has(stateKey)) {
          diagnostics.push(createDiagnostic({
            code: DIAGNOSTIC_CODES.BEHAVIOR_STATE_KEY_MISSING,
            severity: SEVERITY.WARNING,
            message: `Behavior action "${type}" references state key "${stateKey}" which is not declared in the top-level state map.`,
            jsonPointer: `${pointer}/${typeof action.stateKey === 'string' ? 'stateKey' : 'key'}`,
            expected: 'a key declared in state',
            actual: stateKey,
            suggestedFixText: `Add "${stateKey}" to the top-level state object (with an initial value), or fix the typo.`
          }));
        }
      }
    }
  };

  inspect(definition.behaviors, '/behaviors');
  const scenes = Array.isArray(definition.scenes) ? definition.scenes : [];
  for (let s = 0; s < scenes.length; s += 1) {
    inspect(scenes[s]?.behaviors, `/scenes/${s}/behaviors`);
  }

  return diagnostics;
}

// ─── Category 5: Tween references ──────────────────────────────────────────

function checkTweenReferences(definition) {
  const diagnostics = [];
  const entityKeys = collectAllEntityKeys(definition);

  const inspect = (tweens, basePointer) => {
    if (!Array.isArray(tweens)) return;
    for (let t = 0; t < tweens.length; t += 1) {
      const tween = tweens[t];
      if (!tween || typeof tween !== 'object') continue;
      if (typeof tween.target !== 'string') continue;
      if (entityKeys.has(tween.target)) continue;
      diagnostics.push(createDiagnostic({
        code: DIAGNOSTIC_CODES.TWEEN_TARGET_MISSING,
        severity: SEVERITY.WARNING,
        message: `Tween "${tween.id || `#${t}`}" targets entity "${tween.target}" which is not defined.`,
        jsonPointer: `${basePointer}/${t}/target`,
        expected: 'target to match an existing entity.key',
        actual: tween.target,
        suggestedFixText: `Add an entity with key "${tween.target}" to a scene, or fix the tween target.`
      }));
    }
  };

  inspect(definition.animations, '/animations');
  const scenes = Array.isArray(definition.scenes) ? definition.scenes : [];
  for (let s = 0; s < scenes.length; s += 1) {
    inspect(scenes[s]?.animations, `/scenes/${s}/animations`);
  }

  return diagnostics;
}

// ─── Category 6: Engine flags vs content ───────────────────────────────────

function checkEngineFlagsVsContent(definition) {
  const diagnostics = [];
  const engine = definition.engine || {};
  const scenes = Array.isArray(definition.scenes) ? definition.scenes : [];
  const prefabs = Object.values(definition.prefabs || {});
  const allEntities = [
    ...scenes.flatMap((scene) => scene?.entities || []),
    ...prefabs
  ];

  const uses3D = allEntities.some((e) => e?.mesh || e?.model) || scenes.some((s) => (s?.lights || []).length > 0);
  const uses2D = allEntities.some((e) => e?.sprite)
    || (Array.isArray(definition.ui) && definition.ui.length > 0)
    || scenes.some((s) => (s?.ui || []).length > 0);
  const usesPhysics = allEntities.some((e) => e?.rigidBody);

  if (engine.enable3D === false && uses3D) {
    diagnostics.push(createDiagnostic({
      code: DIAGNOSTIC_CODES.THREE_D_DISABLED_BUT_HAS_3D,
      severity: SEVERITY.WARNING,
      message: 'engine.enable3D is false but the definition contains 3D content (mesh / model / lights). The 3D objects will not render.',
      jsonPointer: '/engine/enable3D',
      expected: true,
      actual: false,
      suggestedFixText: 'Set engine.enable3D to true, or remove the mesh/model/lights from the affected entities and scenes.'
    }));
  }

  if (engine.enable2D === false && uses2D) {
    diagnostics.push(createDiagnostic({
      code: DIAGNOSTIC_CODES.TWO_D_DISABLED_BUT_HAS_2D,
      severity: SEVERITY.WARNING,
      message: 'engine.enable2D is false but the definition contains 2D content (sprites / UI). The 2D layer will not render.',
      jsonPointer: '/engine/enable2D',
      expected: true,
      actual: false,
      suggestedFixText: 'Set engine.enable2D to true, or remove sprites and UI elements.'
    }));
  }

  if (engine.enablePhysics === false && usesPhysics) {
    diagnostics.push(createDiagnostic({
      code: DIAGNOSTIC_CODES.PHYSICS_DISABLED_BUT_RIGIDBODY,
      severity: SEVERITY.WARNING,
      message: 'engine.enablePhysics is false but entities declare rigidBody. Physics will not step and colliders will be inert.',
      jsonPointer: '/engine/enablePhysics',
      expected: true,
      actual: false,
      suggestedFixText: 'Set engine.enablePhysics to true, or remove rigidBody from the affected entities.'
    }));
  }

  return diagnostics;
}

// ─── Category 7: RigidBody quality ─────────────────────────────────────────

function checkRigidBodyQuality(definition) {
  const diagnostics = [];

  const inspect = (entity, pointer) => {
    if (!entity || typeof entity !== 'object') return;
    if (!entity.rigidBody) return;
    const hasVisual = !!(entity.mesh || entity.model || entity.sprite);
    if (!hasVisual) {
      diagnostics.push(createDiagnostic({
        code: DIAGNOSTIC_CODES.RIGIDBODY_NO_VISUAL,
        severity: SEVERITY.WARNING,
        message: `Entity "${entity.key || '<unkeyed>'}" has a rigidBody but no mesh/model/sprite — it is an invisible collider.`,
        jsonPointer: `${pointer}/rigidBody`,
        expected: 'a sibling mesh, model, or sprite for visualization',
        actual: 'rigidBody-only entity',
        suggestedFixText: `If this is intentional (invisible wall, trigger volume), ignore. Otherwise add a mesh or model to "${entity.key || '<unkeyed>'}".`
      }));
    }
  };

  eachSceneEntity(definition, (entity, _scene, pointer) => inspect(entity, pointer));
  eachPrefabEntity(definition, (entity, _key, pointer) => inspect(entity, pointer));
  return diagnostics;
}

// ─── Category 8: Input bindings present when a player exists ───────────────

function looksLikePlayer(entity) {
  if (!entity || typeof entity !== 'object') return false;
  const keyIsPlayer = typeof entity.key === 'string' && /player/i.test(entity.key);
  const tagIsPlayer = Array.isArray(entity.tags) && entity.tags.some((t) => /player/i.test(String(t)));
  const isDynamic = entity.rigidBody?.type === 'dynamic';
  return (keyIsPlayer || tagIsPlayer) && isDynamic;
}

function checkInputBindings(definition) {
  const diagnostics = [];
  const bindings = definition.inputBindings || {};
  const bindingCount = typeof bindings === 'object' && !Array.isArray(bindings) ? Object.keys(bindings).length : 0;
  if (bindingCount > 0) return diagnostics;

  const scenes = Array.isArray(definition.scenes) ? definition.scenes : [];
  const hasPlayer = scenes.some((scene) => (scene?.entities || []).some(looksLikePlayer));
  if (!hasPlayer) return diagnostics;

  diagnostics.push(createDiagnostic({
    code: DIAGNOSTIC_CODES.INPUT_BINDINGS_EMPTY_WITH_PLAYER,
    severity: SEVERITY.WARNING,
    message: 'A dynamic player-like entity exists but inputBindings is empty. The player will not respond to keyboard input.',
    jsonPointer: '/inputBindings',
    expected: 'an inputBindings map with moveLeft / moveRight / jump (or similar)',
    actual: {},
    suggestedFixText: 'Populate inputBindings, e.g. { moveLeft: ["ArrowLeft","KeyA"], moveRight: ["ArrowRight","KeyD"], jump: ["Space","ArrowUp"] }.'
  }));

  return diagnostics;
}

function checkPlayabilityContract(definition) {
  const diagnostics = [];
  const scenes = Array.isArray(definition.scenes) ? definition.scenes : [];
  const initialSceneKey = definition.initialScene || scenes[0]?.key;
  const initialSceneIndex = scenes.findIndex((scene) => scene?.key === initialSceneKey);
  const scene = initialSceneIndex >= 0 ? scenes[initialSceneIndex] : null;
  if (!scene) return diagnostics;

  const entities = Array.isArray(scene.entities) ? scene.entities : [];
  const player = entities.find(looksLikePlayer);
  const hasGroundCollider = entities.some((entity) => {
    const tags = Array.isArray(entity?.tags) ? entity.tags.map((tag) => String(tag).toLowerCase()) : [];
    const key = String(entity?.key || '').toLowerCase();
    return entity?.rigidBody?.type === 'static'
      && entity.rigidBody?.collider
      && (tags.includes('ground') || tags.includes('world') || tags.includes('platform') || /ground|platform|floor|world/.test(key));
  });
  const sceneBehaviors = Array.isArray(scene.behaviors) ? scene.behaviors : [];
  const rootBehaviors = Array.isArray(definition.behaviors) ? definition.behaviors : [];
  const hasGameplayBehavior = [...rootBehaviors, ...sceneBehaviors].some((behavior) => {
    const trigger = typeof behavior?.trigger === 'string'
      ? behavior.trigger
      : behavior?.trigger?.type || behavior?.trigger?.trigger;
    const actions = Array.isArray(behavior?.actions) ? behavior.actions : [];
    return ['inputDown', 'inputPressed', 'keyDown', 'collision', 'timer', 'sceneStart'].includes(String(trigger))
      && actions.some((action) => SUPPORTED_BEHAVIOR_ACTIONS.has(action?.type || action?.action));
  });

  const reasons = [];
  if (!player) reasons.push('missing dynamic player entity tagged/keyed as player');
  if (!hasGroundCollider) reasons.push('missing static ground/platform/world collider');
  if (!hasGameplayBehavior) reasons.push('missing root/scene behavior rules with supported actions');

  if (reasons.length > 0) {
    diagnostics.push(createDiagnostic({
      code: DIAGNOSTIC_CODES.INITIAL_SCENE_NOT_PLAYABLE,
      severity: SEVERITY.WARNING,
      message: `Initial scene "${scene.key}" is not playable: ${reasons.join('; ')}.`,
      jsonPointer: `/scenes/${initialSceneIndex}`,
      expected: 'initialScene to point to a playable scene with player, ground/platform collider, and supported behavior rules',
      actual: reasons,
      suggestedFixText: 'Set initialScene to the gameplay scene, or make this scene directly playable. Do not use a menu scene unless it has a supported switchScene action into gameplay.'
    }));
  }

  if (!player) {
    diagnostics.push(createDiagnostic({
      code: DIAGNOSTIC_CODES.PLAYABLE_SCENE_NO_PLAYER,
      severity: SEVERITY.WARNING,
      message: `Initial scene "${scene.key}" has no dynamic player entity.`,
      jsonPointer: `/scenes/${initialSceneIndex}/entities`,
      expected: 'an entity with key/tag player and dynamic rigidBody',
      actual: 'none',
      suggestedFixText: 'Add key "player", tag "player", visual component, dynamic rigidBody, collider, and cameraTarget.'
    }));
  }

  if (!hasGroundCollider) {
    diagnostics.push(createDiagnostic({
      code: DIAGNOSTIC_CODES.PLAYABLE_SCENE_NO_GROUND_COLLIDER,
      severity: SEVERITY.WARNING,
      message: `Initial scene "${scene.key}" has no static ground/platform collider.`,
      jsonPointer: `/scenes/${initialSceneIndex}/entities`,
      expected: 'at least one static ground/platform/world rigidBody collider',
      actual: 'none',
      suggestedFixText: 'Add a visible ground/platform entity with rigidBody.type="static" and a cuboid collider.'
    }));
  }

  if (!hasGameplayBehavior) {
    diagnostics.push(createDiagnostic({
      code: DIAGNOSTIC_CODES.PLAYABLE_SCENE_NO_BEHAVIOR_RULES,
      severity: SEVERITY.WARNING,
      message: `Initial scene "${scene.key}" has no supported gameplay behavior rules.`,
      jsonPointer: `/scenes/${initialSceneIndex}/behaviors`,
      expected: 'scene.behaviors or top-level behaviors using supported actions',
      actual: 'none',
      suggestedFixText: 'Move behavior rules to scene.behaviors or top-level behaviors. Do not put behaviors on entities; entity behaviors are not part of the runtime contract.'
    }));
  }

  return diagnostics;
}

module.exports = {
  runAllChecks,
  checkCameraConsistency,
  checkVisibility,
  checkAssetConsistency,
  checkBehaviorReferences,
  checkTweenReferences,
  checkEngineFlagsVsContent,
  checkRigidBodyQuality,
  checkInputBindings,
  checkPlayabilityContract
};
