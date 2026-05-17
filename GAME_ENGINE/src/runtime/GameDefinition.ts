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

export const ModelDefinitionSchema = z.object({
  assetKey: z.string().min(1),
  positionOffset: Vec3Schema.default({ x: 0, y: 0, z: 0 }),
  rotationOffset: Vec3Schema.default({ x: 0, y: 0, z: 0 }),
  scale: Vec3Schema.default({ x: 1, y: 1, z: 1 }),
  castShadow: z.boolean().default(false),
  receiveShadow: z.boolean().default(false),
});

const PhysicsMaterialNameSchema = z.enum(['default', 'ice', 'metal', 'rubber', 'wood', 'flesh']);

const ColliderOptionsSchema = z.object({
  density: z.number().positive().optional(),
  friction: z.number().min(0).optional(),
  restitution: z.number().min(0).optional(),
  sensor: z.boolean().optional(),
  material: PhysicsMaterialNameSchema.optional(),
}).strict();

const MovingPlatformDefinitionSchema = z.union([
  z.object({
    kind: z.literal('path'),
    waypoints: z.array(Vec3Schema).min(2),
    speed: z.number().positive().default(1),
    mode: z.enum(['loop', 'pingpong', 'once']).default('loop'),
  }),
  z.object({
    kind: z.literal('velocity'),
    velocity: Vec3Schema,
  }),
]);

const CharacterControllerPresetSchema = z.enum(['platformer2d', 'runner2d', 'simple3d', 'topdown']);

const CharacterControllerDefinitionSchema = z.object({
  preset: CharacterControllerPresetSchema,
});

const TriggerActionListSchema = z.array(
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
      position: Vec3Schema.optional(),
    })
    .passthrough(),
);

const TriggerVolumeDefinitionSchema = z
  .object({
    onEnter: TriggerActionListSchema.optional(),
    onExit: TriggerActionListSchema.optional(),
    onStay: TriggerActionListSchema.optional(),
  })
  .refine(
    (definition) => Boolean(definition.onEnter?.length || definition.onExit?.length || definition.onStay?.length),
    'A trigger must declare at least one of onEnter, onExit, or onStay.',
  );

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
  model: ModelDefinitionSchema.optional(),
  rigidBody: RigidBodyDefinitionSchema.optional(),
  sprite: SpriteDefinitionSchema.optional(),
  cameraTarget: CameraTargetDefinitionSchema.optional(),
  characterController: CharacterControllerDefinitionSchema.optional(),
  movingPlatform: MovingPlatformDefinitionSchema.optional(),
  trigger: TriggerVolumeDefinitionSchema.optional(),
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
    name: z.string().optional(),
    key: z.string().optional(),
    input: z.string().optional(),
    entityTag: z.string().optional(),
    withTag: z.string().optional(),
    stateKey: z.string().optional(),
    event: z.string().optional(),
    every: z.number().positive().optional(),
    everySeconds: z.number().positive().optional(),
    seconds: z.number().positive().optional(),
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
    name: z.string().optional(),
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
export type ModelDefinition = z.infer<typeof ModelDefinitionSchema>;
export type RigidBodyDefinition = z.infer<typeof RigidBodyDefinitionSchema>;
export type MovingPlatformDefinition = z.infer<typeof MovingPlatformDefinitionSchema>;
export type CharacterControllerDefinition = z.infer<typeof CharacterControllerDefinitionSchema>;
export type CharacterControllerPreset = z.infer<typeof CharacterControllerPresetSchema>;
export type TriggerVolumeDefinitionData = z.infer<typeof TriggerVolumeDefinitionSchema>;
export type SpriteDefinition = z.infer<typeof SpriteDefinitionSchema>;
export type BehaviorDefinition = z.infer<typeof BehaviorDefinitionSchema>;
export type TweenDefinition = z.infer<typeof TweenDefinitionSchema>;
export type SpawnerDefinition = z.infer<typeof SpawnerDefinitionSchema>;
export type UiDefinition = z.infer<typeof UiDefinitionSchema>;
export type AudioRule = z.infer<typeof AudioRuleSchema>;
export type LightDefinition = z.infer<typeof LightDefinitionSchema>;
export type PrefabDefinition = z.infer<typeof PrefabDefinitionSchema>;

export interface GameDefinitionNormalizationWarning {
  code: string;
  path: string;
  before: unknown;
  after: unknown;
  message: string;
}

export function parseGameDefinition(input: unknown): GameDefinition {
  return parseGameDefinitionWithWarnings(input).definition;
}

export function parseGameDefinitionWithWarnings(input: unknown): {
  definition: GameDefinition;
  warnings: GameDefinitionNormalizationWarning[];
} {
  const normalized = normalizeGameDefinitionCandidateWithWarnings(input);
  const definition = GameDefinitionSchema.parse(normalized.candidate);
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

export function normalizeGameDefinitionCandidate(input: unknown): unknown {
  return normalizeGameDefinitionCandidateWithWarnings(input).candidate;
}

export function normalizeGameDefinitionCandidateWithWarnings(input: unknown): {
  candidate: unknown;
  warnings: GameDefinitionNormalizationWarning[];
} {
  const candidate = clonePlainObject(input);
  const warnings: GameDefinitionNormalizationWarning[] = [];
  if (!isRecord(candidate)) return { candidate: input, warnings };

  normalizeInitialScene(candidate, warnings);
  normalizeAssetColors(candidate, warnings);

  const scenes = Array.isArray(candidate.scenes) ? candidate.scenes : [];
  scenes.forEach((scene, index) => normalizeScene(scene, warnings, `scenes.${index}`));
  normalizeUiList(candidate.ui, warnings, 'ui');
  normalizeEntityMap(candidate.prefabs, warnings, 'prefabs');
  normalizeEngineFlags(candidate, warnings);

  return { candidate, warnings };
}

function clonePlainObject(input: unknown): unknown {
  if (!input || typeof input !== 'object') return input;
  return JSON.parse(JSON.stringify(input));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function addNormalizationWarning(
  warnings: GameDefinitionNormalizationWarning[],
  code: string,
  path: string,
  before: unknown,
  after: unknown,
  message: string,
): void {
  warnings.push({ code, path, before, after, message });
}

function normalizeInitialScene(definition: Record<string, unknown>, warnings: GameDefinitionNormalizationWarning[]): void {
  const scenes = Array.isArray(definition.scenes) ? definition.scenes : [];
  if (!scenes.length) return;
  const firstScene = scenes[0];
  if (!isRecord(firstScene) || typeof firstScene.key !== 'string') return;
  const sceneKeys = new Set(scenes.map((scene) => (isRecord(scene) ? scene.key : undefined)).filter(Boolean));
  if (typeof definition.initialScene !== 'string' || !sceneKeys.has(definition.initialScene)) {
    const before = definition.initialScene;
    definition.initialScene = firstScene.key;
    addNormalizationWarning(warnings, 'normalized.initialScene', 'initialScene', before, definition.initialScene, 'Initial scene was set to the first valid scene.');
  }
}

function normalizeScene(scene: unknown, warnings: GameDefinitionNormalizationWarning[], path: string): void {
  if (!isRecord(scene)) return;
  normalizeSceneSystems(scene, warnings, path);
  normalizeEntityList(scene.entities, warnings, `${path}.entities`);
  normalizeUiList(scene.ui, warnings, `${path}.ui`);
}

function normalizeEntityMap(entitiesByKey: unknown, warnings: GameDefinitionNormalizationWarning[], path: string): void {
  if (!isRecord(entitiesByKey)) return;
  for (const [key, entity] of Object.entries(entitiesByKey)) normalizeEntity(entity, warnings, `${path}.${key}`);
}

function normalizeEntityList(entities: unknown, warnings: GameDefinitionNormalizationWarning[], path: string): void {
  if (!Array.isArray(entities)) return;
  entities.forEach((entity, index) => normalizeEntity(entity, warnings, `${path}.${index}`));
}

function normalizeEntity(entity: unknown, warnings: GameDefinitionNormalizationWarning[], path: string): void {
  if (!isRecord(entity)) return;
  normalizeCameraTarget(entity, warnings, path);
  normalizeTransform(entity.transform, warnings, `${path}.transform`);
  normalizeMesh(entity.mesh, warnings, `${path}.mesh`);
  normalizeRigidBody(entity.rigidBody, entity.mesh, warnings, `${path}.rigidBody`);
  normalizeSprite(entity.sprite, warnings, `${path}.sprite`);
}

function normalizeMesh(mesh: unknown, warnings: GameDefinitionNormalizationWarning[], path: string): void {
  if (!isRecord(mesh)) return;
  normalizeVec3Field(mesh, 'size', false, warnings, path);
}

function normalizeTransform(transform: unknown, warnings: GameDefinitionNormalizationWarning[], path: string): void {
  if (!isRecord(transform)) return;
  normalizeVec3Field(transform, 'position', false, warnings, path);
  normalizeVec3Field(transform, 'scale', false, warnings, path);
  normalizeVec3Field(transform, 'rotation', true, warnings, path);
  if (!isRecord(transform.rotation) || transform.rotation.w !== undefined) return;
  const before = clonePlainObject(transform.rotation);
  transform.rotation.w = 1;
  addNormalizationWarning(warnings, 'normalized.rotationQuaternionW', `${path}.rotation.w`, before, clonePlainObject(transform.rotation), 'Missing quaternion w was defaulted to 1.');
}

function normalizeRigidBody(rigidBody: unknown, mesh: unknown, warnings: GameDefinitionNormalizationWarning[], path: string): void {
  if (!isRecord(rigidBody)) return;
  normalizeRigidBodyType(rigidBody, warnings, path);

  if (!isRecord(rigidBody.collider)) {
    const inferred = inferColliderFromMesh(mesh);
    rigidBody.collider = inferred as unknown as Record<string, unknown>;
    addNormalizationWarning(
      warnings,
      'normalized.colliderInferred',
      `${path}.collider`,
      undefined,
      clonePlainObject(inferred),
      'rigidBody.collider was missing and inferred from sibling mesh.'
    );
  }
  const collider = rigidBody.collider as Record<string, unknown>;
  if (collider.shape === 'box') {
    const before = clonePlainObject(collider);
    collider.shape = 'cuboid';
    if (!collider.halfExtents) collider.halfExtents = halfExtentsFromSize(isRecord(collider.size) ? collider.size : isRecord(mesh) ? mesh.size : undefined);
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

function normalizeMaterialConflict(rigidBody: Record<string, unknown>, warnings: GameDefinitionNormalizationWarning[], path: string): void {
  const options = isRecord(rigidBody.colliderOptions) ? rigidBody.colliderOptions : null;
  if (!options) return;
  const material = typeof options.material === 'string' ? options.material : undefined;
  if (!material) return;
  for (const key of ['friction', 'restitution', 'density'] as const) {
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

function halfExtentsFromSize(size: unknown): { x: number; y: number; z: number } {
  if (isRecord(size)) {
    return {
      x: finitePositive(size.x) ? size.x / 2 : 0.5,
      y: finitePositive(size.y) ? size.y / 2 : 0.5,
      z: finitePositive(size.z) ? size.z / 2 : 0.5,
    };
  }
  return { x: 0.5, y: 0.5, z: 0.5 };
}

function finitePositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function normalizeSprite(sprite: unknown, warnings: GameDefinitionNormalizationWarning[], path: string): void {
  if (!isRecord(sprite)) return;
  if (!sprite.kind && typeof sprite.text === 'string') {
    sprite.kind = 'text';
    addNormalizationWarning(warnings, 'normalized.spriteTextKind', `${path}.kind`, undefined, 'text', 'Text sprite kind was inferred.');
  }
  if (!sprite.kind && typeof sprite.assetKey === 'string') {
    sprite.kind = 'image';
    addNormalizationWarning(warnings, 'normalized.spriteImageKind', `${path}.kind`, undefined, 'image', 'Image sprite kind was inferred from assetKey.');
  }
  normalizeStyleColor(sprite.style, warnings, `${path}.style`);
  normalizeStyleFontSize(sprite.style, warnings, `${path}.style`);
}

function normalizeUiList(ui: unknown, warnings: GameDefinitionNormalizationWarning[], path: string): void {
  if (!Array.isArray(ui)) return;
  ui.forEach((item, index) => {
    if (!isRecord(item)) return;
    if (!item.type && typeof item.text === 'string') {
      item.type = 'text';
      addNormalizationWarning(warnings, 'normalized.uiTextType', `${path}.${index}.type`, undefined, 'text', 'Text UI type was inferred.');
    }
    normalizeStyleColor(item.style, warnings, `${path}.${index}.style`);
    normalizeStyleFontSize(item.style, warnings, `${path}.${index}.style`);
  });
}

function normalizeAssetColors(value: unknown, warnings: GameDefinitionNormalizationWarning[], path = ''): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((child, index) => normalizeAssetColors(child, warnings, `${path}.${index}`));
    return;
  }
  const record = value as Record<string, unknown>;
  for (const key of ['color', 'fillColor', 'backgroundColor']) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      const before = record[key];
      record[key] = normalizeColorValue(record[key]);
      if (record[key] !== before) addNormalizationWarning(warnings, 'normalized.color', path ? `${path}.${key}` : key, before, record[key], 'Color value was normalized.');
    }
  }
  for (const [key, child] of Object.entries(record)) normalizeAssetColors(child, warnings, path ? `${path}.${key}` : key);
}

function normalizeStyleColor(style: unknown, warnings: GameDefinitionNormalizationWarning[], path: string): void {
  if (!isRecord(style)) return;
  for (const key of ['color', 'stroke']) {
    if (Object.prototype.hasOwnProperty.call(style, key)) {
      const before = style[key];
      style[key] = normalizeColorValue(style[key]);
      if (style[key] !== before) addNormalizationWarning(warnings, 'normalized.color', `${path}.${key}`, before, style[key], 'Style color value was normalized.');
    }
  }
}

function normalizeColorValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  if (/^0x[0-9a-fA-F]{6}$/.test(trimmed)) return Number.parseInt(trimmed.slice(2), 16);
  return trimmed;
}

// ─── AI-drift normalizers (lenient + log) ─────────────────────────────────

const VALID_RIGID_BODY_TYPES = new Set(['dynamic', 'static', 'kinematic']);
const VALID_SCENE_SYSTEMS = new Set(['physicsSync', 'camera', 'behavior', 'tween', 'spawner', 'ui', 'audio']);

function normalizeVec3Field(record: Record<string, unknown>, key: string, expectW: boolean, warnings: GameDefinitionNormalizationWarning[], path: string): void {
  const value = record[key];
  if (!Array.isArray(value)) return;
  if (value.length < 3) return;
  const [x, y, z, w] = value as unknown[];
  if (![x, y, z].every((n) => typeof n === 'number' && Number.isFinite(n))) return;
  const before = clonePlainObject(value);
  const next: Record<string, number> = expectW
    ? { x: x as number, y: y as number, z: z as number, w: typeof w === 'number' && Number.isFinite(w) ? w : 1 }
    : { x: x as number, y: y as number, z: z as number };
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

function normalizeRigidBodyType(rigidBody: Record<string, unknown>, warnings: GameDefinitionNormalizationWarning[], path: string): void {
  const before = rigidBody.type;
  if (typeof before !== 'string') return;
  if (VALID_RIGID_BODY_TYPES.has(before)) return;
  if (/^(sensor|trigger|ghost|area)$/i.test(before)) {
    rigidBody.type = 'static';
    const options = isRecord(rigidBody.colliderOptions) ? rigidBody.colliderOptions : {};
    rigidBody.colliderOptions = { ...options, sensor: true };
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

interface InferredCollider {
  shape: 'cuboid' | 'ball' | 'capsule';
  halfExtents?: { x: number; y: number; z: number };
  radius?: number;
  halfHeight?: number;
}

function inferColliderFromMesh(mesh: unknown): InferredCollider {
  if (!isRecord(mesh)) return { shape: 'cuboid', halfExtents: { x: 0.5, y: 0.5, z: 0.5 } };
  switch (mesh.shape) {
    case 'box':
      return { shape: 'cuboid', halfExtents: halfExtentsFromSize(isRecord(mesh.size) ? mesh.size : undefined) };
    case 'sphere':
      return { shape: 'ball', radius: finitePositive(mesh.radius) ? mesh.radius : 0.5 };
    case 'cylinder':
    case 'cone': {
      const height = finitePositive(mesh.height) ? mesh.height : 1;
      const radius = finitePositive(mesh.radiusTop)
        ? mesh.radiusTop
        : finitePositive(mesh.radius) ? mesh.radius : 0.25;
      return { shape: 'capsule', halfHeight: height / 2, radius };
    }
    case 'plane': {
      const size = isRecord(mesh.size) ? mesh.size : null;
      const sx = size && finitePositive(size.x) ? size.x : 1;
      const sy = size && finitePositive(size.y) ? size.y : 1;
      return { shape: 'cuboid', halfExtents: { x: sx / 2, y: 0.05, z: sy / 2 } };
    }
    default:
      return { shape: 'cuboid', halfExtents: { x: 0.5, y: 0.5, z: 0.5 } };
  }
}

function normalizeSceneSystems(scene: Record<string, unknown>, warnings: GameDefinitionNormalizationWarning[], path: string): void {
  if (!Array.isArray(scene.systems)) return;
  const before = [...(scene.systems as unknown[])];
  const seen = new Set<string>();
  const filtered: string[] = [];
  const dropped = new Set<string>();
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
  if (filtered.length === 0) {
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

function normalizeCameraTarget(entity: Record<string, unknown>, warnings: GameDefinitionNormalizationWarning[], path: string): void {
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

function normalizeStyleFontSize(style: unknown, warnings: GameDefinitionNormalizationWarning[], path: string): void {
  if (!isRecord(style)) return;
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

function normalizeEngineFlags(definition: Record<string, unknown>, warnings: GameDefinitionNormalizationWarning[]): void {
  if (!isRecord(definition.engine)) return;
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

function collectRuntimeUsage(definition: Record<string, unknown>): { uses3D: boolean; uses2D: boolean; usesPhysics: boolean } {
  const scenes = Array.isArray(definition.scenes) ? definition.scenes.filter(isRecord) : [];
  const sceneEntities = scenes.flatMap((scene) => (Array.isArray(scene.entities) ? scene.entities.filter(isRecord) : []));
  const prefabEntities = isRecord(definition.prefabs) ? Object.values(definition.prefabs).filter(isRecord) : [];
  const entities = [...sceneEntities, ...prefabEntities];
  return {
    uses3D: entities.some((entity) => !!entity.model || !!entity.mesh) || scenes.some((scene) => Array.isArray(scene.lights) && scene.lights.length > 0),
    uses2D: entities.some((entity) => !!entity.sprite) || (Array.isArray(definition.ui) && definition.ui.length > 0) || scenes.some((scene) => Array.isArray(scene.ui) && scene.ui.length > 0),
    usesPhysics: entities.some((entity) => !!entity.rigidBody),
  };
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

function validateAssetReferences(definition: GameDefinition): void {
  const assetsByKey = new Map(definition.assets.map((asset) => [asset.key, asset]));
  const entities: EntityDefinition[] = [
    ...definition.scenes.flatMap((scene) => scene.entities),
    ...Object.entries(definition.prefabs).map(([key, prefab]) => ({ ...prefab, key })),
  ];

  for (const entity of entities) {
    if (entity.model) validateAssetReference(assetsByKey, entity.model.assetKey, ['gltf'], `Entity "${entity.key}" model`);
    if (entity.sprite?.kind === 'image') validateAssetReference(assetsByKey, entity.sprite.assetKey, ['image', 'spritesheet', 'atlas'], `Entity "${entity.key}" sprite`);
  }

  const audioRules = [...definition.audio, ...definition.scenes.flatMap((scene) => scene.audio)];
  for (const rule of audioRules) {
    const key = rule.asset ?? rule.sound;
    if (key) validateAssetReference(assetsByKey, key, ['audio'], 'Audio rule');
  }

  const behaviors = [...definition.behaviors, ...definition.scenes.flatMap((scene) => scene.behaviors)];
  for (const behavior of behaviors) {
    for (const action of behavior.actions) {
      const type = action.type ?? action.action;
      const key = action.asset ?? action.sound;
      if (type === 'playSound' && key) validateAssetReference(assetsByKey, key, ['audio'], 'playSound action');
    }
  }
}

function validateAssetReference(
  assetsByKey: Map<string, AssetDefinition>,
  key: string,
  allowedTypes: AssetDefinition['type'][],
  label: string,
): void {
  const asset = assetsByKey.get(key);
  if (!asset && label.endsWith('model')) throw new Error(`${label.replace(' model', '')} references missing model asset "${key}".`);
  if (!asset) throw new Error(`${label} references missing asset "${key}".`);
  if (!allowedTypes.includes(asset.type)) {
    throw new Error(`${label} references asset "${key}" with type "${asset.type}" but expected ${allowedTypes.join(', ')}.`);
  }
}
