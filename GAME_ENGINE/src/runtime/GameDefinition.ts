import { z } from 'zod';

const Vec2Schema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

const Vec3Schema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite(),
});

const QuaternionSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite(),
  w: z.number().finite(),
});

const ColorSchema = z.union([z.number().int().nonnegative(), z.string().min(1)]);
const StateValueSchema = z.union([z.number().finite(), z.string(), z.boolean()]);
const AssetUrlSchema = z.string().min(1).refine((url) => {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith('//') || trimmed.includes('..')) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return isAllowedRemoteAssetUrl(trimmed);
  return true;
}, 'asset url must be same-origin relative, data:, or Supabase Storage.');
const DEFAULT_TRANSFORM = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
};
const DEFAULT_TEXT_STYLE = {
  fontFamily: 'Verdana',
  fontSize: '24px',
  color: '#ffffff',
};
const DEFAULT_ENGINE_OPTIONS = {
  enable3D: true,
  enable2D: true,
  enablePhysics: true,
  gravity: { x: 0, y: -9.81, z: 0 },
};

export const AssetDefinitionSchema = z.object({
  key: z.string().min(1),
  type: z.enum(['image', 'spritesheet', 'atlas', 'tilemap', 'gltf', 'audio', 'json', 'text', 'arrayBuffer']),
  url: AssetUrlSchema,
  crossOrigin: z.enum(['', 'anonymous', 'use-credentials']).optional(),
  frameWidth: z.number().int().positive().optional(),
  frameHeight: z.number().int().positive().optional(),
  margin: z.number().int().min(0).optional(),
  spacing: z.number().int().min(0).optional(),
});

export const TransformDefinitionSchema = z.object({
  position: Vec3Schema.default({ x: 0, y: 0, z: 0 }),
  rotation: QuaternionSchema.default({ x: 0, y: 0, z: 0, w: 1 }),
  scale: Vec3Schema.default({ x: 1, y: 1, z: 1 }),
});

const MaterialSchema = {
  color: ColorSchema.default(0xffffff),
  metalness: z.number().min(0).max(1).default(0),
  roughness: z.number().min(0).max(1).default(0.6),
};

export const MeshDefinitionSchema = z.discriminatedUnion('shape', [
  z.object({
    shape: z.literal('box'),
    size: Vec3Schema.default({ x: 1, y: 1, z: 1 }),
    ...MaterialSchema,
  }),
  z.object({
    shape: z.literal('sphere'),
    radius: z.number().positive().default(0.5),
    widthSegments: z.number().int().min(4).max(128).default(32),
    heightSegments: z.number().int().min(4).max(64).default(16),
    ...MaterialSchema,
  }),
  z.object({
    shape: z.literal('plane'),
    size: Vec2Schema.default({ x: 1, y: 1 }),
    ...MaterialSchema,
  }),
  z.object({
    shape: z.literal('cylinder'),
    radiusTop: z.number().nonnegative().default(0.5),
    radiusBottom: z.number().nonnegative().default(0.5),
    height: z.number().positive().default(1),
    radialSegments: z.number().int().min(3).max(128).default(32),
    ...MaterialSchema,
  }),
  z.object({
    shape: z.literal('cone'),
    radius: z.number().positive().default(0.5),
    height: z.number().positive().default(1),
    radialSegments: z.number().int().min(3).max(128).default(32),
    ...MaterialSchema,
  }),
  z.object({
    shape: z.literal('torus'),
    radius: z.number().positive().default(0.5),
    tube: z.number().positive().default(0.15),
    radialSegments: z.number().int().min(3).max(128).default(16),
    tubularSegments: z.number().int().min(3).max(256).default(64),
    ...MaterialSchema,
  }),
]);

const ColliderOptionsSchema = z.object({
  density: z.number().positive().optional(),
  friction: z.number().min(0).optional(),
  restitution: z.number().min(0).optional(),
  sensor: z.boolean().optional(),
});

const ColliderDefinitionSchema = z.discriminatedUnion('shape', [
  z.object({
    shape: z.literal('cuboid'),
    halfExtents: Vec3Schema.default({ x: 0.5, y: 0.5, z: 0.5 }),
  }),
  z.object({
    shape: z.literal('ball'),
    radius: z.number().positive().default(0.5),
  }),
  z.object({
    shape: z.literal('capsule'),
    halfHeight: z.number().positive().default(0.5),
    radius: z.number().positive().default(0.25),
  }),
]);

export const RigidBodyDefinitionSchema = z.object({
  type: z.enum(['dynamic', 'static', 'kinematic']).default('dynamic'),
  collider: ColliderDefinitionSchema,
  linearDamping: z.number().min(0).optional(),
  angularDamping: z.number().min(0).optional(),
  ccd: z.boolean().default(false),
  colliderOptions: ColliderOptionsSchema.default({}),
});

const TextStyleSchema = z.object({
  fontFamily: z.string().default('Verdana'),
  fontSize: z.string().default('24px'),
  color: z.string().default('#ffffff'),
  stroke: z.string().optional(),
  strokeThickness: z.number().min(0).optional(),
});

export const SpriteDefinitionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('text'),
    text: z.string().default(''),
    x: z.number().finite().default(0),
    y: z.number().finite().default(0),
    style: TextStyleSchema.default(DEFAULT_TEXT_STYLE),
    followIn3D: z.boolean().default(false),
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
    origin: Vec2Schema.default({ x: 0.5, y: 0.5 }),
    followIn3D: z.boolean().default(false),
  }),
]);

export const CameraTargetDefinitionSchema = z.object({
  lerp: z.number().positive().default(5),
  offset: Vec3Schema.default({ x: 0, y: 5, z: 10 }),
});

export const EntityDefinitionSchema = z.object({
  key: z.string().min(1),
  name: z.string().optional(),
  transform: TransformDefinitionSchema.default(DEFAULT_TRANSFORM),
  mesh: MeshDefinitionSchema.optional(),
  rigidBody: RigidBodyDefinitionSchema.optional(),
  sprite: SpriteDefinitionSchema.optional(),
  cameraTarget: CameraTargetDefinitionSchema.optional(),
  tags: z.array(z.string().min(1)).default([]),
  data: z.record(z.string(), z.unknown()).default({}),
});

const StateEntrySchema = z.union([
  StateValueSchema,
  z.object({
    type: z.enum(['number', 'string', 'boolean']).optional(),
    initial: StateValueSchema,
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
  }),
]);

const LooseTriggerSchema = z
  .object({
    type: z.string().optional(),
    trigger: z.string().optional(),
    key: z.string().optional(),
    input: z.string().optional(),
    entityTag: z.string().optional(),
    withTag: z.string().optional(),
    stateKey: z.string().optional(),
    event: z.string().optional(),
    every: z.number().positive().optional(),
    once: z.boolean().optional(),
  })
  .passthrough();

const ConditionSchema = z
  .object({
    type: z.string().optional(),
    stateKey: z.string().optional(),
    key: z.string().optional(),
    equals: StateValueSchema.optional(),
    notEquals: StateValueSchema.optional(),
    gt: z.number().finite().optional(),
    gte: z.number().finite().optional(),
    lt: z.number().finite().optional(),
    lte: z.number().finite().optional(),
    tag: z.string().optional(),
    target: z.unknown().optional(),
  })
  .passthrough();

const ActionSchema = z
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
    position: Vec3Schema.optional(),
  })
  .passthrough();

export const BehaviorDefinitionSchema = z
  .object({
    id: z.string().optional(),
    trigger: z.union([z.string(), LooseTriggerSchema]),
    conditions: z.array(ConditionSchema).default([]),
    actions: z.array(ActionSchema).default([]),
  })
  .passthrough();

export const TweenDefinitionSchema = z.object({
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
  trigger: z.union([z.string(), LooseTriggerSchema]).optional(),
  keyframes: z
    .array(
      z.object({
        t: z.number().min(0),
        value: z.number().finite(),
      }),
    )
    .optional(),
});

export const SpawnerDefinitionSchema = z.object({
  id: z.string().optional(),
  prefab: z.string().min(1),
  positions: z.array(Vec3Schema).default([]),
  count: z.number().int().min(0).optional(),
  area: z
    .object({
      min: Vec3Schema,
      max: Vec3Schema,
    })
    .optional(),
  everySeconds: z.number().positive().optional(),
  maxAlive: z.number().int().positive().optional(),
  tags: z.array(z.string().min(1)).default([]),
});

export const UiDefinitionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    id: z.string().optional(),
    text: z.string().default(''),
    x: z.number().finite().default(16),
    y: z.number().finite().default(16),
    style: TextStyleSchema.default(DEFAULT_TEXT_STYLE),
    depth: z.number().finite().default(1000),
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
    fillColor: ColorSchema.default('#22c55e'),
    backgroundColor: ColorSchema.default('#334155'),
    depth: z.number().finite().default(1000),
  }),
]);

export const AudioRuleSchema = z.object({
  id: z.string().optional(),
  trigger: z.union([z.string(), LooseTriggerSchema]),
  asset: z.string().min(1).optional(),
  sound: z.string().min(1).optional(),
  volume: z.number().min(0).max(1).default(1),
  cooldownMs: z.number().min(0).default(0),
});

export const LightDefinitionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('ambient'),
    color: ColorSchema.default('#ffffff'),
    intensity: z.number().min(0).default(0.55),
  }),
  z.object({
    type: z.literal('directional'),
    color: ColorSchema.default('#ffffff'),
    intensity: z.number().min(0).default(0.9),
    position: Vec3Schema.default({ x: 5, y: 10, z: 7 }),
    castShadow: z.boolean().default(false),
  }),
  z.object({
    type: z.literal('point'),
    color: ColorSchema.default('#ffffff'),
    intensity: z.number().min(0).default(1),
    position: Vec3Schema.default({ x: 0, y: 2, z: 0 }),
    distance: z.number().min(0).default(0),
    decay: z.number().min(0).default(2),
  }),
]);

export const PrefabDefinitionSchema = EntityDefinitionSchema.omit({ key: true }).extend({
  key: z.string().optional(),
});

const SceneSystemSchema = z.enum(['physicsSync', 'camera', 'behavior', 'tween', 'spawner', 'ui', 'audio']);

export const SceneDefinitionSchema = z.object({
  key: z.string().min(1),
  name: z.string().optional(),
  background: ColorSchema.optional(),
  systems: z.array(SceneSystemSchema).default(['physicsSync', 'camera']),
  lights: z.array(LightDefinitionSchema).default([]),
  entities: z.array(EntityDefinitionSchema).default([]),
  behaviors: z.array(BehaviorDefinitionSchema).default([]),
  animations: z.array(TweenDefinitionSchema).default([]),
  spawners: z.array(SpawnerDefinitionSchema).default([]),
  ui: z.array(UiDefinitionSchema).default([]),
  audio: z.array(AudioRuleSchema).default([]),
});

export const GameDefinitionSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  metadata: z.object({
    title: z.string().min(1),
    description: z.string().default(''),
    genre: z.string().default('unknown'),
    estimatedPlaytime: z.string().optional(),
    createdAt: z.string().optional(),
  }),
  engine: z
    .object({
      width: z.number().int().positive().optional(),
      height: z.number().int().positive().optional(),
      enable3D: z.boolean().default(true),
      enable2D: z.boolean().default(true),
      enablePhysics: z.boolean().default(true),
      gravity: Vec3Schema.default({ x: 0, y: -9.81, z: 0 }),
      background: ColorSchema.nullable().optional(),
    })
    .default(DEFAULT_ENGINE_OPTIONS),
  state: z.record(z.string(), StateEntrySchema).default({}),
  inputBindings: z.record(z.string(), z.array(z.string().min(1))).default({}),
  assets: z.array(AssetDefinitionSchema).default([]),
  prefabs: z.record(z.string(), PrefabDefinitionSchema).default({}),
  behaviors: z.array(BehaviorDefinitionSchema).default([]),
  animations: z.array(TweenDefinitionSchema).default([]),
  ui: z.array(UiDefinitionSchema).default([]),
  audio: z.array(AudioRuleSchema).default([]),
  scenes: z.array(SceneDefinitionSchema).min(1),
  initialScene: z.string().optional(),
});

export type AssetDefinition = z.infer<typeof AssetDefinitionSchema>;
export type GameDefinition = z.infer<typeof GameDefinitionSchema>;
export type SceneDefinition = z.infer<typeof SceneDefinitionSchema>;
export type EntityDefinition = z.infer<typeof EntityDefinitionSchema>;
export type MeshDefinition = z.infer<typeof MeshDefinitionSchema>;
export type RigidBodyDefinition = z.infer<typeof RigidBodyDefinitionSchema>;
export type SpriteDefinition = z.infer<typeof SpriteDefinitionSchema>;
export type BehaviorDefinition = z.infer<typeof BehaviorDefinitionSchema>;
export type TweenDefinition = z.infer<typeof TweenDefinitionSchema>;
export type SpawnerDefinition = z.infer<typeof SpawnerDefinitionSchema>;
export type UiDefinition = z.infer<typeof UiDefinitionSchema>;
export type AudioRule = z.infer<typeof AudioRuleSchema>;
export type LightDefinition = z.infer<typeof LightDefinitionSchema>;
export type PrefabDefinition = z.infer<typeof PrefabDefinitionSchema>;

export function parseGameDefinition(input: unknown): GameDefinition {
  const definition = GameDefinitionSchema.parse(input);
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

function isAllowedRemoteAssetUrl(url: string): boolean {
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

function validateSceneEntityKeys(scene: SceneDefinition): void {
  const keys = new Set<string>();
  for (const entity of scene.entities) {
    if (keys.has(entity.key)) throw new Error(`Scene "${scene.key}" contains duplicate entity key "${entity.key}".`);
    keys.add(entity.key);
  }
}

function validateSpawnerPrefabs(spawners: SpawnerDefinition[], prefabs: Record<string, PrefabDefinition>): void {
  for (const spawner of spawners) {
    if (!prefabs[spawner.prefab]) throw new Error(`Spawner references missing prefab "${spawner.prefab}".`);
  }
}

function validateSceneReferences(scene: { key: string; behaviors: BehaviorDefinition[] }, sceneKeys: Set<string>): void {
  for (const behavior of scene.behaviors) {
    for (const action of behavior.actions) {
      const type = action.type ?? action.action;
      const targetScene = typeof action.scene === 'string' ? action.scene : typeof action.target === 'string' ? action.target : undefined;
      if (type === 'switchScene' && targetScene && !sceneKeys.has(targetScene)) {
        throw new Error(`Behavior in scene "${scene.key}" switches to missing scene "${targetScene}".`);
      }
    }
  }
}
