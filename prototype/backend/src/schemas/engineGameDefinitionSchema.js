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
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return isAllowedRemoteAssetUrl(trimmed);
  return true;
}, 'asset url must be same-origin relative, data:, or Supabase Storage.');

function isAllowedRemoteAssetUrl(url) {
  if (url.startsWith('data:')) return true;
  try {
    const parsed = new URL(url);
    const isSupabaseCloud = parsed.protocol === 'https:' && parsed.hostname.endsWith('.supabase.co');
    const isLocalSupabase =
      parsed.protocol === 'http:' &&
      (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') &&
      parsed.port === '54321';
    return (isSupabaseCloud || isLocalSupabase) && parsed.pathname.startsWith('/storage/v1/object/');
  } catch {
    return false;
  }
}

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

function normalizeGameDefinitionCandidate(input) {
  return normalizeGameDefinitionCandidateWithWarnings(input).candidate;
}

function normalizeGameDefinitionCandidateWithWarnings(input) {
  const candidate = clonePlainObject(input);
  const warnings = [];
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return { candidate: input, warnings };

  // Shape coercions must run first — schema rejects object-vs-array mismatches outright.
  coerceCollectionShapes(candidate, warnings);

  normalizeMetadata(candidate, warnings);
  normalizeInitialScene(candidate, warnings);
  normalizeAssetColors(candidate, warnings);

  filterPlaceholderAssets(candidate, warnings);
  filterInvalidSpawners(candidate, warnings);

  const scenes = Array.isArray(candidate.scenes) ? candidate.scenes : [];
  for (const [index, scene] of scenes.entries()) normalizeScene(scene, warnings, `scenes.${index}`);
  normalizeUiList(candidate.ui, warnings, 'ui');
  normalizeAudioRules(candidate.audio, warnings, 'audio');
  normalizeEntityMap(candidate.prefabs, warnings, 'prefabs');
  normalizeBehaviors(candidate, warnings);
  normalizeEngineFlags(candidate, warnings);

  injectDefaultInputBindings(candidate, warnings);
  injectDefaultPlayerBehaviors(candidate, warnings);

  return { candidate, warnings };
}

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

const modelDefinitionSchema = z.object({
  assetKey: z.string().min(1),
  positionOffset: vec3Schema.default({ x: 0, y: 0, z: 0 }),
  rotationOffset: vec3Schema.default({ x: 0, y: 0, z: 0 }),
  scale: vec3Schema.default({ x: 1, y: 1, z: 1 }),
  castShadow: z.boolean().default(false),
  receiveShadow: z.boolean().default(false)
});

const physicsMaterialNameSchema = z.enum(['default', 'ice', 'metal', 'rubber', 'wood', 'flesh']);

const colliderOptionsSchema = z.object({
  density: z.number().positive().optional(),
  friction: z.number().min(0).optional(),
  restitution: z.number().min(0).optional(),
  sensor: z.boolean().optional(),
  material: physicsMaterialNameSchema.optional()
});

const movingPlatformDefinitionSchema = z.union([
  z.object({
    kind: z.literal('path'),
    waypoints: z.array(vec3Schema).min(2),
    speed: z.number().positive().default(1),
    mode: z.enum(['loop', 'pingpong', 'once']).default('loop')
  }),
  z.object({
    kind: z.literal('velocity'),
    velocity: vec3Schema
  })
]);

const characterControllerPresetSchema = z.enum(['platformer2d', 'runner2d', 'simple3d', 'topdown']);

const characterControllerDefinitionSchema = z.object({
  preset: characterControllerPresetSchema
});

const triggerActionListSchema = z.array(
  z
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
      scene: z.string().optional(),
      prefab: z.string().optional(),
      tags: z.array(z.string().min(1)).optional(),
      tag: z.string().optional(),
      volume: z.number().min(0).max(1).optional(),
      payload: z.unknown().optional(),
      position: vec3Schema.optional()
    })
    .passthrough()
);

const triggerVolumeDefinitionSchema = z
  .object({
    onEnter: triggerActionListSchema.optional(),
    onExit: triggerActionListSchema.optional(),
    onStay: triggerActionListSchema.optional()
  })
  .refine(
    (definition) => Boolean(definition.onEnter?.length || definition.onExit?.length || definition.onStay?.length),
    'A trigger must declare at least one of onEnter, onExit, or onStay.'
  );

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
  model: modelDefinitionSchema.optional(),
  rigidBody: rigidBodyDefinitionSchema.optional(),
  sprite: spriteDefinitionSchema.optional(),
  cameraTarget: cameraTargetDefinitionSchema.optional(),
  characterController: characterControllerDefinitionSchema.optional(),
  movingPlatform: movingPlatformDefinitionSchema.optional(),
  trigger: triggerVolumeDefinitionSchema.optional(),
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
  return parseEngineGameDefinitionWithWarnings(input).definition;
}

function parseEngineGameDefinitionWithWarnings(input) {
  const normalized = normalizeGameDefinitionCandidateWithWarnings(input);
  const definition = gameDefinitionSchema.parse(normalized.candidate);
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
  validateAssetReferences(definition);
  return { definition, warnings: normalized.warnings };
}

function clonePlainObject(input) {
  if (!input || typeof input !== 'object') return input;
  return JSON.parse(JSON.stringify(input));
}

function addNormalizationWarning(warnings, code, path, before, after, message) {
  warnings.push({ code, path, before, after, message });
}

function normalizeInitialScene(definition, warnings) {
  const scenes = Array.isArray(definition.scenes) ? definition.scenes : [];
  if (!scenes.length) return;
  const sceneKeys = new Set(scenes.map((scene) => scene && scene.key).filter(Boolean));
  if (!definition.initialScene || !sceneKeys.has(definition.initialScene)) {
    const before = definition.initialScene;
    definition.initialScene = scenes[0].key;
    addNormalizationWarning(warnings, 'normalized.initialScene', 'initialScene', before, definition.initialScene, 'Initial scene was set to the first valid scene.');
  }
}

function normalizeScene(scene, warnings, path) {
  if (!scene || typeof scene !== 'object') return;
  normalizeSceneSystems(scene, warnings, path);
  normalizeEntityList(scene.entities, warnings, `${path}.entities`);
  normalizeUiList(scene.ui, warnings, `${path}.ui`);
  normalizeAudioRules(scene.audio, warnings, `${path}.audio`);
}

function normalizeEntityMap(entitiesByKey, warnings, path) {
  if (!entitiesByKey || typeof entitiesByKey !== 'object' || Array.isArray(entitiesByKey)) return;
  for (const [key, entity] of Object.entries(entitiesByKey)) normalizeEntity(entity, warnings, `${path}.${key}`);
}

function normalizeEntityList(entities, warnings, path) {
  if (!Array.isArray(entities)) return;
  for (const [index, entity] of entities.entries()) normalizeEntity(entity, warnings, `${path}.${index}`);
}

function normalizeEntity(entity, warnings, path) {
  if (!entity || typeof entity !== 'object') return;
  normalizeCameraTarget(entity, warnings, path);
  normalizeTransform(entity.transform, warnings, `${path}.transform`);
  normalizeMesh(entity.mesh, warnings, `${path}.mesh`);
  normalizeRigidBody(entity.rigidBody, entity.mesh, warnings, `${path}.rigidBody`);
  normalizeSprite(entity.sprite, warnings, `${path}.sprite`);
}

function normalizeMesh(mesh, warnings, path) {
  if (!mesh || typeof mesh !== 'object') return;
  normalizeVec3Field(mesh, 'size', false, warnings, path);
}

function normalizeTransform(transform, warnings, path) {
  if (!transform || typeof transform !== 'object') return;
  normalizeVec3Field(transform, 'position', false, warnings, path);
  normalizeVec3Field(transform, 'scale', false, warnings, path);
  normalizeVec3Field(transform, 'rotation', true, warnings, path);
  const rotation = transform.rotation;
  if (rotation && typeof rotation === 'object' && !Array.isArray(rotation) && rotation.w === undefined) {
    const before = clonePlainObject(rotation);
    rotation.w = 1;
    addNormalizationWarning(warnings, 'normalized.rotationQuaternionW', `${path}.rotation.w`, before, clonePlainObject(rotation), 'Missing quaternion w was defaulted to 1.');
  }
}

function normalizeRigidBody(rigidBody, mesh, warnings, path) {
  if (!rigidBody || typeof rigidBody !== 'object') return;
  normalizeRigidBodyType(rigidBody, warnings, path);

  let collider = rigidBody.collider;
  if (!collider || typeof collider !== 'object') {
    collider = inferColliderFromMesh(mesh);
    rigidBody.collider = collider;
    addNormalizationWarning(warnings, 'normalized.colliderInferred', `${path}.collider`, undefined, clonePlainObject(collider), 'rigidBody.collider was missing and inferred from sibling mesh.');
  }

  if (collider.shape === 'box') {
    const before = clonePlainObject(collider);
    collider.shape = 'cuboid';
    if (!collider.halfExtents) {
      collider.halfExtents = halfExtentsFromSize(collider.size || mesh?.size);
    }
    addNormalizationWarning(warnings, 'normalized.colliderBoxToCuboid', `${path}.collider`, before, clonePlainObject(collider), 'Collider shape box was normalized to cuboid.');
  }
  if (collider.shape === 'sphere') {
    const before = clonePlainObject(collider);
    collider.shape = 'ball';
    addNormalizationWarning(warnings, 'normalized.colliderSphereToBall', `${path}.collider.shape`, before, clonePlainObject(collider), 'Collider shape sphere was normalized to ball.');
  }

  normalizeVec3Field(collider, 'halfExtents', false, warnings, `${path}.collider`);
  normalizeMaterialConflict(rigidBody, warnings, path);
}

function normalizeMaterialConflict(rigidBody, warnings, path) {
  const options = rigidBody.colliderOptions;
  if (!options || typeof options !== 'object') return;
  if (typeof options.material !== 'string') return;
  const material = options.material;
  for (const key of ['friction', 'restitution', 'density']) {
    if (!Object.prototype.hasOwnProperty.call(options, key)) continue;
    const before = options[key];
    delete options[key];
    addNormalizationWarning(
      warnings,
      'normalized.colliderMaterialConflict',
      `${path}.colliderOptions.${key}`,
      before,
      undefined,
      `colliderOptions.${key} was dropped because colliderOptions.material="${material}" was already specified.`
    );
  }
}

function halfExtentsFromSize(size) {
  if (size && typeof size === 'object') {
    const x = finitePositive(size.x) ? size.x / 2 : 0.5;
    const y = finitePositive(size.y) ? size.y / 2 : 0.5;
    const z = finitePositive(size.z) ? size.z / 2 : 0.5;
    return { x, y, z };
  }
  return { x: 0.5, y: 0.5, z: 0.5 };
}

function finitePositive(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function normalizeSprite(sprite, warnings, path) {
  if (!sprite || typeof sprite !== 'object') return;
  if (!sprite.kind && typeof sprite.text === 'string') {
    sprite.kind = 'text';
    addNormalizationWarning(warnings, 'normalized.spriteTextKind', `${path}.kind`, undefined, 'text', 'Text sprite kind was inferred.');
  }
  if (!sprite.kind && typeof sprite.assetKey === 'string') {
    sprite.kind = 'image';
    addNormalizationWarning(warnings, 'normalized.spriteImageKind', `${path}.kind`, undefined, 'image', 'Image sprite kind was inferred from assetKey.');
  }
  if (sprite.style) {
    normalizeStyleColor(sprite.style, warnings, `${path}.style`);
    normalizeStyleFontSize(sprite.style, warnings, `${path}.style`);
  }
}

function normalizeUiList(ui, warnings, path) {
  if (!Array.isArray(ui)) return;
  for (let index = ui.length - 1; index >= 0; index -= 1) {
    const item = ui[index];
    if (!item || typeof item !== 'object') continue;
    if (!item.type && typeof item.text === 'string') {
      item.type = 'text';
      addNormalizationWarning(warnings, 'normalized.uiTextType', `${path}.${index}.type`, undefined, 'text', 'Text UI type was inferred.');
    }
    if (item.type && item.type !== 'text' && item.type !== 'bar') {
      if (typeof item.text === 'string' || typeof item.label === 'string' || typeof item.title === 'string' || typeof item.content === 'string') {
        const before = item.type;
        item.text = String(item.text ?? item.label ?? item.title ?? item.content);
        item.type = 'text';
        addNormalizationWarning(warnings, 'normalized.uiUnsupportedTypeToText', `${path}.${index}.type`, before, 'text', 'Unsupported UI item type was normalized to text.');
      } else if (item.value !== undefined) {
        const before = item.type;
        item.value = String(item.value);
        item.type = 'bar';
        if (item.max === undefined) item.max = 100;
        addNormalizationWarning(warnings, 'normalized.uiUnsupportedTypeToBar', `${path}.${index}.type`, before, 'bar', 'Unsupported UI item type was normalized to bar because it had a value field.');
      } else {
        const before = clonePlainObject(item);
        ui.splice(index, 1);
        addNormalizationWarning(warnings, 'normalized.uiUnsupportedTypeDropped', `${path}.${index}`, before, null, 'Unsupported UI item was dropped instead of failing the whole GameDefinition.');
        continue;
      }
    }
    if (item.style) {
      normalizeStyleColor(item.style, warnings, `${path}.${index}.style`);
      normalizeStyleFontSize(item.style, warnings, `${path}.${index}.style`);
    }
  }
}

function normalizeAudioRules(rules, warnings, path) {
  if (!Array.isArray(rules)) return;
  for (let index = rules.length - 1; index >= 0; index -= 1) {
    const rule = rules[index];
    if (!rule || typeof rule !== 'object' || Array.isArray(rule) || !isValidLooseTrigger(rule.trigger)) {
      const before = clonePlainObject(rule);
      rules.splice(index, 1);
      addNormalizationWarning(warnings, 'normalized.audioRuleInvalidDropped', `${path}.${index}`, before, null, 'Audio rule with an invalid trigger was dropped.');
    }
  }
}

function isValidLooseTrigger(trigger) {
  if (typeof trigger === 'string') return trigger.trim().length > 0;
  return !!trigger && typeof trigger === 'object' && !Array.isArray(trigger);
}

function normalizeAssetColors(value, warnings, path = '') {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((child, index) => normalizeAssetColors(child, warnings, `${path}.${index}`));
    return;
  }

  for (const key of ['color', 'fillColor', 'backgroundColor']) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      const before = value[key];
      value[key] = normalizeColorValue(value[key]);
      if (value[key] !== before) {
        addNormalizationWarning(warnings, 'normalized.color', path ? `${path}.${key}` : key, before, value[key], 'Color value was normalized.');
      }
    }
  }
  for (const [key, child] of Object.entries(value)) normalizeAssetColors(child, warnings, path ? `${path}.${key}` : key);
}

function normalizeStyleColor(style, warnings, path) {
  if (!style || typeof style !== 'object') return;
  for (const key of ['color', 'stroke']) {
    if (Object.prototype.hasOwnProperty.call(style, key)) {
      const before = style[key];
      style[key] = normalizeColorValue(style[key]);
      if (style[key] !== before) {
        addNormalizationWarning(warnings, 'normalized.color', `${path}.${key}`, before, style[key], 'Style color value was normalized.');
      }
    }
  }
}

function normalizeColorValue(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  if (/^0x[0-9a-fA-F]{6}$/.test(trimmed)) {
    return Number.parseInt(trimmed.slice(2), 16);
  }
  return trimmed;
}

// ─── AI-drift normalizers (lenient + log) ─────────────────────────────────

const VALID_RIGID_BODY_TYPES = new Set(['dynamic', 'static', 'kinematic']);
const VALID_SCENE_SYSTEMS = new Set(['physicsSync', 'camera', 'behavior', 'tween', 'spawner', 'ui', 'audio']);

/** Coerce {position|scale|halfExtents|...} from [x,y,z] arrays to {x,y,z} objects. */
function normalizeVec3Field(record, key, expectW, warnings, path) {
  if (!record || typeof record !== 'object') return;
  const value = record[key];
  if (!Array.isArray(value)) return;
  if (value.length < 3) return;
  const [x, y, z, w] = value;
  if (![x, y, z].every((n) => typeof n === 'number' && Number.isFinite(n))) return;
  const before = clonePlainObject(value);
  const next = expectW
    ? { x, y, z, w: typeof w === 'number' && Number.isFinite(w) ? w : 1 }
    : { x, y, z };
  record[key] = next;
  addNormalizationWarning(
    warnings,
    'normalized.vec3FromArray',
    `${path}.${key}`,
    before,
    clonePlainObject(next),
    expectW ? 'Quaternion array was normalized to {x,y,z,w} object.' : 'Vec3 array was normalized to {x,y,z} object.'
  );
}

/** Coerce sensor/trigger/etc rigidBody types to schema-valid enum + sensor flag. */
function normalizeRigidBodyType(rigidBody, warnings, path) {
  if (!rigidBody || typeof rigidBody !== 'object') return;
  const before = rigidBody.type;
  if (typeof before !== 'string') return;
  if (VALID_RIGID_BODY_TYPES.has(before)) return;
  if (/^(sensor|trigger|ghost|area)$/i.test(before)) {
    rigidBody.type = 'static';
    rigidBody.colliderOptions = { ...(rigidBody.colliderOptions || {}), sensor: true };
    addNormalizationWarning(
      warnings,
      'normalized.rigidBodyTypeSensor',
      `${path}.type`,
      before,
      'static (colliderOptions.sensor=true)',
      'Sensor/trigger rigidBody type was normalized to static + colliderOptions.sensor=true.'
    );
    return;
  }
  rigidBody.type = 'dynamic';
  addNormalizationWarning(
    warnings,
    'normalized.rigidBodyTypeUnknown',
    `${path}.type`,
    before,
    'dynamic',
    `Unknown rigidBody type "${before}" was normalized to dynamic.`
  );
}

/** Infer a sensible collider from a sibling mesh when collider is missing. */
function inferColliderFromMesh(mesh) {
  if (!mesh || typeof mesh !== 'object') {
    return { shape: 'cuboid', halfExtents: { x: 0.5, y: 0.5, z: 0.5 } };
  }
  switch (mesh.shape) {
    case 'box':
      return { shape: 'cuboid', halfExtents: halfExtentsFromSize(mesh.size) };
    case 'sphere':
      return { shape: 'ball', radius: finitePositive(mesh.radius) ? mesh.radius : 0.5 };
    case 'cylinder':
    case 'cone': {
      const height = finitePositive(mesh.height) ? mesh.height : 1;
      const radius = finitePositive(mesh.radiusTop) ? mesh.radiusTop : (finitePositive(mesh.radius) ? mesh.radius : 0.25);
      return { shape: 'capsule', halfHeight: height / 2, radius };
    }
    case 'plane': {
      const sx = finitePositive(mesh.size?.x) ? mesh.size.x : 1;
      const sy = finitePositive(mesh.size?.y) ? mesh.size.y : 1;
      return { shape: 'cuboid', halfExtents: { x: sx / 2, y: 0.05, z: sy / 2 } };
    }
    default:
      return { shape: 'cuboid', halfExtents: { x: 0.5, y: 0.5, z: 0.5 } };
  }
}

/** Filter scenes[].systems[] to known names; default to ['physicsSync','camera'] if empty. */
function normalizeSceneSystems(scene, warnings, path) {
  if (!scene || !Array.isArray(scene.systems)) return;
  const before = [...scene.systems];
  const seen = new Set();
  const filtered = [];
  const dropped = new Set();
  for (const entry of before) {
    if (typeof entry !== 'string') { dropped.add(String(entry)); continue; }
    if (!VALID_SCENE_SYSTEMS.has(entry)) { dropped.add(entry); continue; }
    if (seen.has(entry)) continue;
    seen.add(entry);
    filtered.push(entry);
  }
  if (dropped.size === 0 && filtered.length === before.length) return;
  scene.systems = filtered;
  for (const name of dropped) {
    addNormalizationWarning(
      warnings,
      'normalized.sceneSystemUnknown',
      `${path}.systems`,
      name,
      null,
      `Unknown scene system "${name}" was removed.`
    );
  }
  if (scene.systems.length === 0) {
    scene.systems = ['physicsSync', 'camera'];
    addNormalizationWarning(
      warnings,
      'normalized.sceneSystemsDefaulted',
      `${path}.systems`,
      before,
      ['physicsSync', 'camera'],
      'scenes[].systems was empty after filtering; defaulted to ["physicsSync","camera"].'
    );
  }
}

/** Coerce cameraTarget boolean shorthand to an object (or remove on false). */
function normalizeCameraTarget(entity, warnings, path) {
  if (!entity || typeof entity !== 'object') return;
  if (typeof entity.cameraTarget !== 'boolean') return;
  const before = entity.cameraTarget;
  if (before) {
    entity.cameraTarget = {};
    addNormalizationWarning(
      warnings,
      'normalized.cameraTargetBoolean',
      `${path}.cameraTarget`,
      true,
      {},
      'cameraTarget=true was normalized to {} (Zod defaults fill lerp/offset).'
    );
  } else {
    delete entity.cameraTarget;
    addNormalizationWarning(
      warnings,
      'normalized.cameraTargetBoolean',
      `${path}.cameraTarget`,
      false,
      undefined,
      'cameraTarget=false was removed (no follow camera).'
    );
  }
}

/** Coerce numeric fontSize (24) or bare-number string ("24") to CSS length ("24px"). */
function normalizeStyleFontSize(style, warnings, path) {
  if (!style || typeof style !== 'object') return;
  if (!Object.prototype.hasOwnProperty.call(style, 'fontSize')) return;
  const before = style.fontSize;
  if (typeof before === 'number' && Number.isFinite(before)) {
    style.fontSize = `${before}px`;
    addNormalizationWarning(
      warnings,
      'normalized.styleFontSize',
      `${path}.fontSize`,
      before,
      style.fontSize,
      'Numeric fontSize was normalized to "<n>px".'
    );
    return;
  }
  if (typeof before === 'string' && /^\s*[0-9]+(\.[0-9]+)?\s*$/.test(before)) {
    style.fontSize = `${before.trim()}px`;
    addNormalizationWarning(
      warnings,
      'normalized.styleFontSize',
      `${path}.fontSize`,
      before,
      style.fontSize,
      'Bare numeric fontSize string was normalized to "<n>px".'
    );
  }
}

function normalizeEngineFlags(definition, warnings) {
  if (!definition.engine || typeof definition.engine !== 'object') return;
  const usage = collectRuntimeUsage(definition);
  if (usage.uses3D && definition.engine.enable3D === false) {
    definition.engine.enable3D = true;
    addNormalizationWarning(warnings, 'normalized.engineEnable3D', 'engine.enable3D', false, true, '3D rendering was enabled because the definition uses 3D components.');
  }
  if (usage.uses2D && definition.engine.enable2D === false) {
    definition.engine.enable2D = true;
    addNormalizationWarning(warnings, 'normalized.engineEnable2D', 'engine.enable2D', false, true, '2D rendering was enabled because the definition uses sprites or UI.');
  }
  if (usage.usesPhysics && definition.engine.enablePhysics === false) {
    definition.engine.enablePhysics = true;
    addNormalizationWarning(warnings, 'normalized.engineEnablePhysics', 'engine.enablePhysics', false, true, 'Physics was enabled because the definition uses rigid bodies.');
  }
}

function collectRuntimeUsage(definition) {
  const entities = [
    ...(Array.isArray(definition.scenes) ? definition.scenes.flatMap((scene) => scene.entities || []) : []),
    ...Object.values(definition.prefabs || {})
  ];
  const scenes = Array.isArray(definition.scenes) ? definition.scenes : [];
  return {
    uses3D: entities.some((entity) => entity?.model || entity?.mesh) || scenes.some((scene) => (scene?.lights || []).length > 0),
    uses2D: entities.some((entity) => entity?.sprite) || Array.isArray(definition.ui) && definition.ui.length > 0 || scenes.some((scene) => (scene?.ui || []).length > 0),
    usesPhysics: entities.some((entity) => entity?.rigidBody)
  };
}

function validateEngineGameDefinitionSafe(input) {
  try {
    const parsed = parseEngineGameDefinitionWithWarnings(input);
    return { ok: true, data: parsed.definition, warnings: parsed.warnings };
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

function validateAssetReferences(definition) {
  const assetsByKey = new Map(definition.assets.map((asset) => [asset.key, asset]));
  const entities = [
    ...definition.scenes.flatMap((scene) => scene.entities),
    ...Object.entries(definition.prefabs).map(([key, prefab]) => ({ ...prefab, key }))
  ];

  for (const entity of entities) {
    if (entity.model) {
      validateAssetReference(assetsByKey, entity.model.assetKey, ['gltf'], `Entity "${entity.key}" model`);
    }
    if (entity.sprite?.kind === 'image') {
      validateAssetReference(assetsByKey, entity.sprite.assetKey, ['image', 'spritesheet', 'atlas'], `Entity "${entity.key}" sprite`);
    }
  }

  const audioRules = [
    ...(definition.audio || []),
    ...definition.scenes.flatMap((scene) => scene.audio || [])
  ];
  for (const rule of audioRules) {
    const key = rule.asset || rule.sound;
    if (key) validateAssetReference(assetsByKey, key, ['audio'], 'Audio rule');
  }

  const behaviors = [
    ...(definition.behaviors || []),
    ...definition.scenes.flatMap((scene) => scene.behaviors || [])
  ];
  for (const behavior of behaviors) {
    for (const action of behavior.actions || []) {
      const type = action.type || action.action;
      const key = action.asset || action.sound;
      if (type === 'playSound' && key) validateAssetReference(assetsByKey, key, ['audio'], 'playSound action');
    }
  }
}

function validateAssetReference(assetsByKey, key, allowedTypes, label) {
  const asset = assetsByKey.get(key);
  if (!asset && label.endsWith('model')) throw new Error(`${label.replace(' model', '')} references missing model asset "${key}".`);
  if (!asset) throw new Error(`${label} references missing asset "${key}".`);
  if (!allowedTypes.includes(asset.type)) {
    throw new Error(`${label} references asset "${key}" with type "${asset.type}" but expected ${allowedTypes.join(', ')}.`);
  }
}

// ─── Metadata default (AI-drift: missing title) ─────────────────────────────

/**
 * Ensure metadata.title exists. AI occasionally returns metadata without title
 * (or as gameTitle from the old schema). The schema requires a non-empty string.
 */
function normalizeMetadata(candidate, warnings) {
  if (!candidate.metadata || typeof candidate.metadata !== 'object') {
    candidate.metadata = { title: 'Untitled Game' };
    addNormalizationWarning(warnings, 'normalized.metadataMissing', 'metadata', undefined, clonePlainObject(candidate.metadata), 'metadata block was missing; populated with a default title.');
    return;
  }
  const md = candidate.metadata;
  if (typeof md.title === 'string' && md.title.trim()) return;
  // Try common aliases the AI uses by mistake.
  for (const alias of ['gameTitle', 'name', 'title']) {
    const v = md[alias];
    if (typeof v === 'string' && v.trim()) {
      const before = md.title;
      md.title = v.trim();
      addNormalizationWarning(warnings, 'normalized.metadataTitleAlias', 'metadata.title', before, md.title, `metadata.title was missing; copied from metadata.${alias}.`);
      return;
    }
  }
  const before = md.title;
  md.title = 'Untitled Game';
  addNormalizationWarning(warnings, 'normalized.metadataTitleDefaulted', 'metadata.title', before, md.title, 'metadata.title was missing or empty; defaulted to "Untitled Game".');
}

// ─── Invalid spawner filter (AI-drift: spawner without prefab) ──────────────

/**
 * Drop spawners that reference no prefab (schema requires a non-empty string).
 * Better to lose the spawner than fail the entire game.
 */
function filterInvalidSpawners(candidate, warnings) {
  if (!Array.isArray(candidate.scenes)) return;
  for (const [i, scene] of candidate.scenes.entries()) {
    if (!scene || !Array.isArray(scene.spawners)) continue;
    const before = scene.spawners.length;
    scene.spawners = scene.spawners.filter((s, j) => {
      if (s && typeof s === 'object' && typeof s.prefab === 'string' && s.prefab.trim()) return true;
      addNormalizationWarning(
        warnings,
        'normalized.spawnerDropped',
        `scenes.${i}.spawners.${j}`,
        clonePlainObject(s),
        null,
        `Spawner at scenes.${i}.spawners.${j} had no prefab reference; dropped.`
      );
      return false;
    });
  }
}

// ─── Shape coercions (AI-drift: wrong collection shape) ─────────────────────

/**
 * The AI occasionally returns top-level collections in the wrong shape:
 *   assets   {key: {...}}  →  [{key, ...}]
 *   prefabs  [{key, ...}]  →  {key: {...}}
 *   scenes   {key: {...}}  →  [{key, ...}]
 * Zod can't recover from these because the schema discriminates by type.
 * We coerce before validation runs.
 */
function coerceCollectionShapes(candidate, warnings) {
  if (candidate.assets && typeof candidate.assets === 'object' && !Array.isArray(candidate.assets)) {
    const before = clonePlainObject(candidate.assets);
    const arr = [];
    for (const [key, value] of Object.entries(candidate.assets)) {
      if (!value || typeof value !== 'object') continue;
      const entry = (value.key && typeof value.key === 'string') ? value : { key, ...value };
      arr.push(entry);
    }
    candidate.assets = arr;
    addNormalizationWarning(warnings, 'normalized.assetsObjectToArray', 'assets', before, clonePlainObject(arr), 'assets was returned as an object map; coerced to array with key copied from map keys.');
  }

  if (Array.isArray(candidate.prefabs)) {
    const before = clonePlainObject(candidate.prefabs);
    const rec = {};
    for (const item of candidate.prefabs) {
      if (!item || typeof item !== 'object') continue;
      const key = typeof item.key === 'string' && item.key ? item.key : null;
      if (!key) continue;
      const { key: _drop, ...rest } = item;
      rec[key] = rest;
    }
    candidate.prefabs = rec;
    addNormalizationWarning(warnings, 'normalized.prefabsArrayToRecord', 'prefabs', before, clonePlainObject(rec), 'prefabs was returned as an array; coerced to record keyed by item.key.');
  }

  if (candidate.scenes && typeof candidate.scenes === 'object' && !Array.isArray(candidate.scenes)) {
    const before = clonePlainObject(candidate.scenes);
    const arr = [];
    for (const [key, value] of Object.entries(candidate.scenes)) {
      if (!value || typeof value !== 'object') continue;
      const entry = (value.key && typeof value.key === 'string') ? value : { key, ...value };
      arr.push(entry);
    }
    candidate.scenes = arr;
    addNormalizationWarning(warnings, 'normalized.scenesObjectToArray', 'scenes', before, clonePlainObject(arr), 'scenes was returned as an object map; coerced to array with key copied from map keys.');
  }
}

// ─── Placeholder asset URL filter ───────────────────────────────────────────

/**
 * Reject placeholder data URLs like `data:,uifont` that pass Zod (any data:
 * URL is allowed) but fail at runtime in the asset loader. Drop the asset and
 * all references to it (entity model/sprite, audio rules, playSound actions).
 */
function isPlaceholderAssetUrl(url) {
  if (typeof url !== 'string') return true;
  const trimmed = url.trim();
  if (!trimmed) return true;

  // Placeholder data: URLs like "data:,uifont" — header is empty and payload is a
  // bare label. Real data URLs have a mime type ("data:image/png;base64,...") or
  // at least a sizable base64 payload.
  if (trimmed.startsWith('data:')) {
    const commaIndex = trimmed.indexOf(',');
    if (commaIndex < 0) return true;
    const header = trimmed.slice(5, commaIndex);
    const payload = trimmed.slice(commaIndex + 1);
    if (header.length === 0 && payload.length < 32) return true;
    if (header.length === 0 && !/^[A-Za-z0-9+/]/.test(payload)) return true;
    return false;
  }

  // Common AI placeholder patterns: bare filenames ("robotSprite.png"), or
  // relative `assets/...` paths that won't resolve under the preview iframe's
  // "/engine-preview/..." base.
  if (!trimmed.includes('/')) return true;
  if (/^assets\//i.test(trimmed)) return true;
  if (/^public\//i.test(trimmed)) return true;

  // Anything else — pass through to schema validation (which is the security
  // layer that rejects evil.example.com etc.).
  return false;
}

function filterPlaceholderAssets(candidate, warnings) {
  if (!Array.isArray(candidate.assets)) return;
  const droppedKeys = new Set();
  const kept = [];
  for (const asset of candidate.assets) {
    if (!asset || typeof asset !== 'object') continue;
    if (isPlaceholderAssetUrl(asset.url)) {
      droppedKeys.add(asset.key);
      addNormalizationWarning(
        warnings,
        'normalized.assetPlaceholderDropped',
        `assets[${asset.key}]`,
        asset.url,
        null,
        `Asset "${asset.key}" had a placeholder URL "${asset.url}" and would fail to load; dropped along with its references.`
      );
      continue;
    }
    kept.push(asset);
  }
  if (kept.length === candidate.assets.length) return;
  candidate.assets = kept;
  if (droppedKeys.size === 0) return;

  // Strip references on entities (both inline scene entities and prefabs).
  const stripEntityRefs = (entity, path) => {
    if (!entity || typeof entity !== 'object') return;
    if (entity.model && droppedKeys.has(entity.model.assetKey)) {
      const before = clonePlainObject(entity.model);
      delete entity.model;
      addNormalizationWarning(warnings, 'normalized.assetReferenceDropped', `${path}.model`, before, null, `Removed model referencing dropped asset.`);
    }
    if (entity.sprite?.kind === 'image' && droppedKeys.has(entity.sprite.assetKey)) {
      const before = clonePlainObject(entity.sprite);
      entity.sprite = { kind: 'text', text: '', x: entity.sprite.x ?? 0, y: entity.sprite.y ?? 0 };
      addNormalizationWarning(warnings, 'normalized.assetReferenceDropped', `${path}.sprite`, before, clonePlainObject(entity.sprite), `Replaced sprite referencing dropped asset with empty text fallback.`);
    }
  };

  // Strip audio rules and playSound actions that reference dropped assets.
  const stripAudioRules = (rules, path) => {
    if (!Array.isArray(rules)) return rules;
    return rules.filter((rule, i) => {
      const key = rule?.asset ?? rule?.sound;
      if (!key || !droppedKeys.has(key)) return true;
      addNormalizationWarning(warnings, 'normalized.assetReferenceDropped', `${path}.${i}`, clonePlainObject(rule), null, `Dropped audio rule referencing dropped asset "${key}".`);
      return false;
    });
  };
  const stripBehaviors = (behaviors, path) => {
    if (!Array.isArray(behaviors)) return;
    for (const [i, b] of behaviors.entries()) {
      if (!b || !Array.isArray(b.actions)) continue;
      b.actions = b.actions.filter((a, j) => {
        const type = a?.type ?? a?.action;
        if (type !== 'playSound') return true;
        const key = a.asset ?? a.sound;
        if (!key || !droppedKeys.has(key)) return true;
        addNormalizationWarning(warnings, 'normalized.assetReferenceDropped', `${path}.${i}.actions.${j}`, clonePlainObject(a), null, `Dropped playSound action referencing dropped asset "${key}".`);
        return false;
      });
    }
  };

  for (const [i, scene] of (candidate.scenes || []).entries()) {
    if (!scene) continue;
    for (const [j, e] of (scene.entities || []).entries()) stripEntityRefs(e, `scenes.${i}.entities.${j}`);
    scene.audio = stripAudioRules(scene.audio, `scenes.${i}.audio`);
    stripBehaviors(scene.behaviors, `scenes.${i}.behaviors`);
  }
  if (candidate.prefabs && typeof candidate.prefabs === 'object' && !Array.isArray(candidate.prefabs)) {
    for (const [k, p] of Object.entries(candidate.prefabs)) stripEntityRefs(p, `prefabs.${k}`);
  }
  candidate.audio = stripAudioRules(candidate.audio, 'audio');
  stripBehaviors(candidate.behaviors, 'behaviors');
}

// ─── Default inputBindings injection ────────────────────────────────────────

/**
 * If inputBindings is empty but the definition has a player entity with a
 * dynamic rigidBody, inject standard platformer keys. Otherwise the schema
 * passes but the game is silent — player can't move.
 */
function injectDefaultInputBindings(candidate, warnings) {
  const ib = candidate.inputBindings;
  const isEmpty = !ib || (typeof ib === 'object' && !Array.isArray(ib) && Object.keys(ib).length === 0);
  if (!isEmpty) return;

  const hasControlledPlayer = (candidate.scenes || []).some((scene) =>
    (scene?.entities || []).some((e) => {
      if (!e || typeof e !== 'object') return false;
      const keyIsPlayer = typeof e.key === 'string' && /player/i.test(e.key);
      const tagIsPlayer = Array.isArray(e.tags) && e.tags.some((t) => /player/i.test(String(t)));
      const isDynamic = e.rigidBody?.type === 'dynamic' || (e.rigidBody && !e.rigidBody.type);
      return (keyIsPlayer || tagIsPlayer) && isDynamic;
    })
  );
  if (!hasControlledPlayer) return;

  const defaults = {
    moveLeft: ['ArrowLeft', 'KeyA'],
    moveRight: ['ArrowRight', 'KeyD'],
    jump: ['Space', 'ArrowUp', 'KeyW'],
    action: ['KeyE', 'Enter']
  };
  candidate.inputBindings = defaults;
  addNormalizationWarning(warnings, 'normalized.inputBindingsDefaulted', 'inputBindings', {}, clonePlainObject(defaults), 'inputBindings was empty but a controlled player exists; injected default platformer keys.');
}

// ─── Default player behaviors (when AI omits movement glue) ────────────────

/**
 * When the AI gives us a controllable player but no behaviors wiring the input
 * bindings to physics, inject the standard platformer movement behaviors so
 * the game is actually playable. Skip if the AI already wrote movement glue.
 */
function injectDefaultPlayerBehaviors(candidate, warnings) {
  if (!Array.isArray(candidate.scenes) || candidate.scenes.length === 0) return;

  const ib = candidate.inputBindings;
  if (!ib || typeof ib !== 'object') return;
  const hasStandardMovementBindings = ib.moveLeft && ib.moveRight && ib.jump;
  if (!hasStandardMovementBindings) return;

  const scene = candidate.scenes[0];
  const player = (scene.entities || []).find((e) => {
    if (!e || typeof e !== 'object') return false;
    const keyIsPlayer = typeof e.key === 'string' && /player/i.test(e.key);
    const tagIsPlayer = Array.isArray(e.tags) && e.tags.some((t) => /player/i.test(String(t)));
    const isDynamic = e.rigidBody?.type === 'dynamic';
    return (keyIsPlayer || tagIsPlayer) && isDynamic;
  });
  if (!player) return;

  const allBehaviors = [...(candidate.behaviors || []), ...(scene.behaviors || [])];
  const hasInputWiring = allBehaviors.some((b) => {
    const trigger = b?.trigger;
    if (!trigger) return false;
    const type = typeof trigger === 'string' ? trigger : trigger.type;
    if (!/^(input|key)/i.test(String(type))) return false;
    const input = typeof trigger === 'object' ? (trigger.input || trigger.key) : null;
    return input ? /move|jump|left|right/i.test(String(input)) : true;
  });
  if (hasInputWiring) return;

  if (!Array.isArray(scene.behaviors)) scene.behaviors = [];
  const playerKey = player.key;
  const injected = [
    { id: '_default_moveLeft', trigger: { type: 'inputDown', input: 'moveLeft' }, actions: [{ type: 'setVelocityX', target: playerKey, value: -5 }] },
    { id: '_default_moveRight', trigger: { type: 'inputDown', input: 'moveRight' }, actions: [{ type: 'setVelocityX', target: playerKey, value: 5 }] },
    { id: '_default_stopLeft', trigger: { type: 'inputReleased', input: 'moveLeft' }, actions: [{ type: 'setVelocityX', target: playerKey, value: 0 }] },
    { id: '_default_stopRight', trigger: { type: 'inputReleased', input: 'moveRight' }, actions: [{ type: 'setVelocityX', target: playerKey, value: 0 }] },
    { id: '_default_jump', trigger: { type: 'inputPressed', input: 'jump' }, actions: [{ type: 'applyImpulse', target: playerKey, value: { x: 0, y: 7, z: 0 } }] }
  ];
  scene.behaviors.push(...injected);
  addNormalizationWarning(
    warnings,
    'normalized.playerBehaviorsDefaulted',
    `scenes.0.behaviors`,
    null,
    injected.map((b) => b.id),
    'Player had standard input bindings but no movement behaviors; injected default platformer wiring (moveLeft/moveRight/jump).'
  );
}

// ─── Behavior action normalization ──────────────────────────────────────────

const ACTION_ALIASES = {
  spawnat: 'spawnPrefab',
  spawn: 'spawnPrefab',
  spawnentity: 'spawnPrefab',
  modifystate: 'incrementState',
  changestate: 'setState',
  updatestate: 'setState',
  updatetext: null,
  settext: null,
  foreachentity: null,
  iterateentities: null,
  loopentities: null,
  noop: null
};

const SUPPORTED_ACTION_TYPES = new Set([
  'setState', 'incrementState', 'decrementState', 'switchScene', 'spawnPrefab', 'destroyEntity',
  'applyImpulse', 'applyForce', 'applyTorque',
  'setVelocity', 'setLinearVelocity', 'setVelocityX', 'setVelocityY', 'setVelocityZ',
  'setAngularVelocity', 'addKnockback',
  'setPosition', 'translate', 'playSound', 'emitEvent', 'addTag', 'removeTag'
]);

function normalizeActionList(actions, warnings, path) {
  if (!Array.isArray(actions)) return actions;
  const result = [];
  for (const [i, action] of actions.entries()) {
    if (!action || typeof action !== 'object') continue;
    const rawType = String(action.type ?? action.action ?? '');
    if (!rawType) continue;
    if (SUPPORTED_ACTION_TYPES.has(rawType)) {
      result.push(action);
      continue;
    }
    const aliasKey = rawType.toLowerCase().replace(/[_\s-]/g, '');
    if (aliasKey in ACTION_ALIASES) {
      const mappedType = ACTION_ALIASES[aliasKey];
      if (mappedType === null) {
        addNormalizationWarning(warnings, 'normalized.actionUnsupportedDropped', `${path}.${i}`, clonePlainObject(action), null, `Unsupported action "${rawType}" was dropped.`);
        continue;
      }
      const before = clonePlainObject(action);
      // Coerce modifyState into incrementState when an amount is present, else setState.
      if (mappedType === 'incrementState' && action.amount === undefined && action.value !== undefined) {
        action.type = 'setState';
        delete action.action;
      } else {
        action.type = mappedType;
        delete action.action;
      }
      addNormalizationWarning(warnings, 'normalized.actionRenamed', `${path}.${i}.type`, before, clonePlainObject(action), `Action "${rawType}" was renamed to "${action.type}".`);
      result.push(action);
      continue;
    }
    addNormalizationWarning(warnings, 'normalized.actionUnsupportedDropped', `${path}.${i}`, clonePlainObject(action), null, `Unknown action "${rawType}" was dropped.`);
  }
  return result;
}

function normalizeBehaviorList(behaviors, warnings, path) {
  if (!Array.isArray(behaviors)) return;
  for (const [i, b] of behaviors.entries()) {
    if (!b || typeof b !== 'object') continue;
    b.actions = normalizeActionList(b.actions, warnings, `${path}.${i}.actions`);
  }
}

function normalizeBehaviors(candidate, warnings) {
  normalizeBehaviorList(candidate.behaviors, warnings, 'behaviors');
  if (Array.isArray(candidate.scenes)) {
    for (const [i, scene] of candidate.scenes.entries()) {
      if (!scene) continue;
      normalizeBehaviorList(scene.behaviors, warnings, `scenes.${i}.behaviors`);
    }
  }
}

module.exports = {
  gameDefinitionSchema,
  normalizeGameDefinitionCandidate,
  normalizeGameDefinitionCandidateWithWarnings,
  parseEngineGameDefinition,
  parseEngineGameDefinitionWithWarnings,
  validateEngineGameDefinitionSafe
};
