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

  normalizeInitialScene(candidate, warnings);
  normalizeAssetColors(candidate, warnings);

  const scenes = Array.isArray(candidate.scenes) ? candidate.scenes : [];
  for (const [index, scene] of scenes.entries()) normalizeScene(scene, warnings, `scenes.${index}`);
  normalizeUiList(candidate.ui, warnings, 'ui');
  normalizeEntityMap(candidate.prefabs, warnings, 'prefabs');
  normalizeEngineFlags(candidate, warnings);

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
  model: modelDefinitionSchema.optional(),
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
  normalizeEntityList(scene.entities, warnings, `${path}.entities`);
  normalizeUiList(scene.ui, warnings, `${path}.ui`);
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
  normalizeTransform(entity.transform, warnings, `${path}.transform`);
  normalizeRigidBody(entity.rigidBody, entity.mesh, warnings, `${path}.rigidBody`);
  normalizeSprite(entity.sprite, warnings, `${path}.sprite`);
}

function normalizeTransform(transform, warnings, path) {
  if (!transform || typeof transform !== 'object') return;
  const rotation = transform.rotation;
  if (rotation && typeof rotation === 'object' && !Array.isArray(rotation) && rotation.w === undefined) {
    const before = clonePlainObject(rotation);
    rotation.w = 1;
    addNormalizationWarning(warnings, 'normalized.rotationQuaternionW', `${path}.rotation.w`, before, clonePlainObject(rotation), 'Missing quaternion w was defaulted to 1.');
  }
}

function normalizeRigidBody(rigidBody, mesh, warnings, path) {
  if (!rigidBody || typeof rigidBody !== 'object') return;
  const collider = rigidBody.collider;
  if (!collider || typeof collider !== 'object') return;

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
  if (sprite.style) normalizeStyleColor(sprite.style, warnings, `${path}.style`);
}

function normalizeUiList(ui, warnings, path) {
  if (!Array.isArray(ui)) return;
  for (const [index, item] of ui.entries()) {
    if (!item || typeof item !== 'object') continue;
    if (!item.type && typeof item.text === 'string') {
      item.type = 'text';
      addNormalizationWarning(warnings, 'normalized.uiTextType', `${path}.${index}.type`, undefined, 'text', 'Text UI type was inferred.');
    }
    if (item.style) normalizeStyleColor(item.style, warnings, `${path}.${index}.style`);
  }
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

module.exports = {
  gameDefinitionSchema,
  normalizeGameDefinitionCandidate,
  normalizeGameDefinitionCandidateWithWarnings,
  parseEngineGameDefinition,
  parseEngineGameDefinitionWithWarnings,
  validateEngineGameDefinitionSafe
};
