/* ============================================================================
   GAME_ENGINE GameDefinition Schema
   ----------------------------------------------------------------------------
   Server-side validator for the declarative runtime used by GAME_ENGINE.
   Keep this intentionally aligned with GAME_ENGINE/src/runtime/GameDefinition.ts.
   ========================================================================= */

const { z } = require('zod');

const vec2Schema = z.object({
  x: z.number().finite(),
  y: z.number().finite()
});

const vec3Schema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite()
});

const quaternionSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite(),
  w: z.number().finite()
});

const colorSchema = z.union([z.number().int().nonnegative(), z.string().min(1)]);
const stateValueSchema = z.union([z.number().finite(), z.string(), z.boolean()]);
const assetUrlSchema = z.string().min(1).refine((url) => {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith('//') || trimmed.includes('..')) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed.startsWith('data:');
  return true;
}, 'asset url must be same-origin relative or data:');

const defaultTransform = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 }
};

const defaultTextStyle = {
  fontFamily: 'Verdana',
  fontSize: '24px',
  color: '#ffffff'
};

const assetDefinitionSchema = z.object({
  key: z.string().min(1),
  type: z.enum(['image', 'spritesheet', 'atlas', 'tilemap', 'gltf', 'audio', 'json', 'text', 'arrayBuffer']),
  url: assetUrlSchema,
  crossOrigin: z.enum(['', 'anonymous', 'use-credentials']).optional(),
  frameWidth: z.number().int().positive().optional(),
  frameHeight: z.number().int().positive().optional(),
  margin: z.number().int().min(0).optional(),
  spacing: z.number().int().min(0).optional()
});

const transformDefinitionSchema = z.object({
  position: vec3Schema.default(defaultTransform.position),
  rotation: quaternionSchema.default(defaultTransform.rotation),
  scale: vec3Schema.default(defaultTransform.scale)
});

const materialSchema = {
  color: colorSchema.default(0xffffff),
  metalness: z.number().min(0).max(1).default(0),
  roughness: z.number().min(0).max(1).default(0.6)
};

const meshDefinitionSchema = z.discriminatedUnion('shape', [
  z.object({
    shape: z.literal('box'),
    size: vec3Schema.default({ x: 1, y: 1, z: 1 }),
    ...materialSchema
  }),
  z.object({
    shape: z.literal('sphere'),
    radius: z.number().positive().default(0.5),
    widthSegments: z.number().int().min(4).max(128).default(32),
    heightSegments: z.number().int().min(4).max(64).default(16),
    ...materialSchema
  }),
  z.object({
    shape: z.literal('plane'),
    size: vec2Schema.default({ x: 1, y: 1 }),
    ...materialSchema
  }),
  z.object({
    shape: z.literal('cylinder'),
    radiusTop: z.number().nonnegative().default(0.5),
    radiusBottom: z.number().nonnegative().default(0.5),
    height: z.number().positive().default(1),
    radialSegments: z.number().int().min(3).max(128).default(32),
    ...materialSchema
  }),
  z.object({
    shape: z.literal('cone'),
    radius: z.number().positive().default(0.5),
    height: z.number().positive().default(1),
    radialSegments: z.number().int().min(3).max(128).default(32),
    ...materialSchema
  }),
  z.object({
    shape: z.literal('torus'),
    radius: z.number().positive().default(0.5),
    tube: z.number().positive().default(0.15),
    radialSegments: z.number().int().min(3).max(128).default(16),
    tubularSegments: z.number().int().min(3).max(256).default(64),
    ...materialSchema
  })
]);

const colliderOptionsSchema = z.object({
  density: z.number().positive().optional(),
  friction: z.number().min(0).optional(),
  restitution: z.number().min(0).optional(),
  sensor: z.boolean().optional()
});

const colliderDefinitionSchema = z.discriminatedUnion('shape', [
  z.object({
    shape: z.literal('cuboid'),
    halfExtents: vec3Schema.default({ x: 0.5, y: 0.5, z: 0.5 })
  }),
  z.object({
    shape: z.literal('ball'),
    radius: z.number().positive().default(0.5)
  }),
  z.object({
    shape: z.literal('capsule'),
    halfHeight: z.number().positive().default(0.5),
    radius: z.number().positive().default(0.25)
  })
]);

const rigidBodyDefinitionSchema = z.object({
  type: z.enum(['dynamic', 'static', 'kinematic']).default('dynamic'),
  collider: colliderDefinitionSchema,
  linearDamping: z.number().min(0).optional(),
  angularDamping: z.number().min(0).optional(),
  ccd: z.boolean().default(false),
  colliderOptions: colliderOptionsSchema.default({})
});

const textStyleSchema = z.object({
  fontFamily: z.string().default('Verdana'),
  fontSize: z.string().default('24px'),
  color: z.string().default('#ffffff'),
  stroke: z.string().optional(),
  strokeThickness: z.number().min(0).optional()
});

const spriteDefinitionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('text'),
    text: z.string().default(''),
    x: z.number().finite().default(0),
    y: z.number().finite().default(0),
    style: textStyleSchema.default(defaultTextStyle),
    followIn3D: z.boolean().default(false)
  }),
  z.object({
    kind: z.literal('image'),
    assetKey: z.string().min(1),
    x: z.number().finite().default(0),
    y: z.number().finite().default(0),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
    alpha: z.number().min(0).max(1).default(1),
    depth: z.number().finite().default(0),
    origin: vec2Schema.default({ x: 0.5, y: 0.5 }),
    followIn3D: z.boolean().default(false)
  })
]);

const cameraTargetDefinitionSchema = z.object({
  lerp: z.number().positive().default(5),
  offset: vec3Schema.default({ x: 0, y: 5, z: 10 })
});

const entityDefinitionSchema = z.object({
  key: z.string().min(1),
  name: z.string().optional(),
  transform: transformDefinitionSchema.default(defaultTransform),
  mesh: meshDefinitionSchema.optional(),
  rigidBody: rigidBodyDefinitionSchema.optional(),
  sprite: spriteDefinitionSchema.optional(),
  cameraTarget: cameraTargetDefinitionSchema.optional(),
  tags: z.array(z.string().min(1)).default([]),
  data: z.record(z.string(), z.unknown()).default({})
});

const stateEntrySchema = z.union([
  stateValueSchema,
  z.object({
    type: z.enum(['number', 'string', 'boolean']).optional(),
    initial: stateValueSchema,
    min: z.number().finite().optional(),
    max: z.number().finite().optional()
  })
]);

const looseTriggerSchema = z
  .object({
    type: z.string().optional(),
    trigger: z.string().optional(),
    key: z.string().optional(),
    input: z.string().optional(),
    entityTag: z.string().optional(),
    withTag: z.string().optional(),
    stateKey: z.string().optional(),
    event: z.string().optional(),
    name: z.string().optional(),
    every: z.number().positive().optional(),
    everySeconds: z.number().positive().optional(),
    seconds: z.number().positive().optional(),
    once: z.boolean().optional()
  })
  .passthrough();

const conditionSchema = z
  .object({
    type: z.string().optional(),
    stateKey: z.string().optional(),
    key: z.string().optional(),
    equals: stateValueSchema.optional(),
    notEquals: stateValueSchema.optional(),
    gt: z.number().finite().optional(),
    gte: z.number().finite().optional(),
    lt: z.number().finite().optional(),
    lte: z.number().finite().optional(),
    tag: z.string().optional(),
    target: z.unknown().optional()
  })
  .passthrough();

const actionSchema = z
  .object({
    type: z.string().optional(),
    action: z.string().optional(),
    target: z.unknown().optional(),
    key: z.string().optional(),
    stateKey: z.string().optional(),
    value: z.unknown().optional(),
    amount: z.number().finite().optional(),
    asset: z.string().optional(),
    sound: z.string().optional(),
    event: z.string().optional(),
    name: z.string().optional(),
    scene: z.string().optional(),
    prefab: z.string().optional(),
    position: vec3Schema.optional(),
    tags: z.array(z.string()).optional(),
    tag: z.string().optional(),
    volume: z.number().min(0).max(1).optional(),
    payload: z.record(z.string(), z.unknown()).optional()
  })
  .passthrough();

const behaviorDefinitionSchema = z
  .object({
    id: z.string().optional(),
    trigger: z.union([z.string(), looseTriggerSchema]),
    conditions: z.array(conditionSchema).default([]),
    actions: z.array(actionSchema).default([])
  })
  .passthrough();

const tweenDefinitionSchema = z.object({
  id: z.string().min(1).optional(),
  target: z.string().min(1),
  property: z.string().min(1).optional(),
  from: z.number().finite().optional(),
  to: z.number().finite().optional(),
  by: z.number().finite().optional(),
  duration: z.number().positive().default(1),
  delay: z.number().min(0).default(0),
  loop: z.boolean().default(false),
  yoyo: z.boolean().default(false),
  easing: z.enum(['linear', 'easeIn', 'easeOut', 'easeInOut']).default('linear'),
  trigger: z.union([z.string(), looseTriggerSchema]).optional(),
  keyframes: z.array(z.object({ t: z.number().min(0), value: z.number().finite() })).optional()
});

const spawnerDefinitionSchema = z.object({
  id: z.string().optional(),
  prefab: z.string().min(1),
  positions: z.array(vec3Schema).default([]),
  count: z.number().int().min(0).optional(),
  area: z.object({ min: vec3Schema, max: vec3Schema }).optional(),
  everySeconds: z.number().positive().optional(),
  maxAlive: z.number().int().positive().optional(),
  tags: z.array(z.string().min(1)).default([])
});

const uiDefinitionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    id: z.string().optional(),
    text: z.string().default(''),
    x: z.number().finite().default(16),
    y: z.number().finite().default(16),
    style: textStyleSchema.default(defaultTextStyle),
    depth: z.number().finite().default(1000)
  }),
  z.object({
    type: z.literal('bar'),
    id: z.string().optional(),
    value: z.string().min(1),
    max: z.union([z.string().min(1), z.number().positive()]).default(100),
    x: z.number().finite().default(16),
    y: z.number().finite().default(16),
    width: z.number().positive().default(160),
    height: z.number().positive().default(16),
    fillColor: colorSchema.default('#22c55e'),
    backgroundColor: colorSchema.default('#334155'),
    depth: z.number().finite().default(1000)
  })
]);

const audioRuleSchema = z.object({
  id: z.string().optional(),
  trigger: z.union([z.string(), looseTriggerSchema]),
  asset: z.string().min(1).optional(),
  sound: z.string().min(1).optional(),
  volume: z.number().min(0).max(1).default(1),
  cooldownMs: z.number().min(0).default(0)
});

const lightDefinitionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('ambient'),
    color: colorSchema.default('#ffffff'),
    intensity: z.number().min(0).default(0.55)
  }),
  z.object({
    type: z.literal('directional'),
    color: colorSchema.default('#ffffff'),
    intensity: z.number().min(0).default(0.9),
    position: vec3Schema.default({ x: 5, y: 10, z: 7 }),
    castShadow: z.boolean().default(false)
  }),
  z.object({
    type: z.literal('point'),
    color: colorSchema.default('#ffffff'),
    intensity: z.number().min(0).default(1),
    position: vec3Schema.default({ x: 0, y: 2, z: 0 }),
    distance: z.number().min(0).default(0),
    decay: z.number().min(0).default(2)
  })
]);

const prefabDefinitionSchema = entityDefinitionSchema.omit({ key: true }).extend({
  key: z.string().optional()
});

const sceneSystemSchema = z.enum(['physicsSync', 'camera', 'behavior', 'tween', 'spawner', 'ui', 'audio']);

const sceneDefinitionSchema = z.object({
  key: z.string().min(1),
  name: z.string().optional(),
  background: colorSchema.optional(),
  systems: z.array(sceneSystemSchema).default(['physicsSync', 'camera']),
  lights: z.array(lightDefinitionSchema).default([]),
  entities: z.array(entityDefinitionSchema).default([]),
  behaviors: z.array(behaviorDefinitionSchema).default([]),
  animations: z.array(tweenDefinitionSchema).default([]),
  spawners: z.array(spawnerDefinitionSchema).default([]),
  ui: z.array(uiDefinitionSchema).default([]),
  audio: z.array(audioRuleSchema).default([])
});

const gameDefinitionSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  metadata: z.object({
    title: z.string().min(1),
    description: z.string().default(''),
    genre: z.string().default('unknown'),
    estimatedPlaytime: z.string().optional(),
    createdAt: z.string().optional()
  }),
  engine: z.object({
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    enable3D: z.boolean().default(true),
    enable2D: z.boolean().default(true),
    enablePhysics: z.boolean().default(true),
    gravity: vec3Schema.default({ x: 0, y: -9.81, z: 0 }),
    background: colorSchema.nullable().optional()
  }).default({
    enable3D: true,
    enable2D: true,
    enablePhysics: true,
    gravity: { x: 0, y: -9.81, z: 0 }
  }),
  state: z.record(z.string(), stateEntrySchema).default({}),
  inputBindings: z.record(z.string(), z.array(z.string().min(1))).default({}),
  assets: z.array(assetDefinitionSchema).default([]),
  prefabs: z.record(z.string(), prefabDefinitionSchema).default({}),
  behaviors: z.array(behaviorDefinitionSchema).default([]),
  animations: z.array(tweenDefinitionSchema).default([]),
  ui: z.array(uiDefinitionSchema).default([]),
  audio: z.array(audioRuleSchema).default([]),
  scenes: z.array(sceneDefinitionSchema).min(1),
  initialScene: z.string().optional()
});

function parseEngineGameDefinition(input) {
  const definition = gameDefinitionSchema.parse(input);
  const sceneKeys = new Set(definition.scenes.map((scene) => scene.key));

  if (definition.initialScene && !sceneKeys.has(definition.initialScene)) {
    throw new Error(`initialScene "${definition.initialScene}" does not match any scene key.`);
  }

  for (const scene of definition.scenes) {
    validateSceneEntityKeys(scene);
    validateSpawnerPrefabs(scene.spawners, definition.prefabs);
    validateSceneReferences(scene, sceneKeys);
  }

  validateSceneReferences({ key: '__global__', behaviors: definition.behaviors }, sceneKeys);
  return definition;
}

function validateEngineGameDefinitionSafe(input) {
  try {
    return { ok: true, data: parseEngineGameDefinition(input) };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return {
        ok: false,
        errors: err.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message
        }))
      };
    }
    return {
      ok: false,
      errors: [{ path: '', message: err.message || String(err) }]
    };
  }
}

function validateSceneEntityKeys(scene) {
  const keys = new Set();
  for (const entity of scene.entities) {
    if (keys.has(entity.key)) throw new Error(`Scene "${scene.key}" contains duplicate entity key "${entity.key}".`);
    keys.add(entity.key);
  }
}

function validateSpawnerPrefabs(spawners, prefabs) {
  for (const spawner of spawners) {
    if (!prefabs[spawner.prefab]) throw new Error(`Spawner references missing prefab "${spawner.prefab}".`);
  }
}

function validateSceneReferences(scene, sceneKeys) {
  for (const behavior of scene.behaviors || []) {
    for (const action of behavior.actions || []) {
      const type = action.type || action.action;
      const targetScene = typeof action.scene === 'string'
        ? action.scene
        : typeof action.target === 'string'
          ? action.target
          : undefined;
      if (type === 'switchScene' && targetScene && !sceneKeys.has(targetScene)) {
        throw new Error(`Behavior in scene "${scene.key}" switches to missing scene "${targetScene}".`);
      }
    }
  }
}

module.exports = {
  gameDefinitionSchema,
  parseEngineGameDefinition,
  validateEngineGameDefinitionSafe
};
