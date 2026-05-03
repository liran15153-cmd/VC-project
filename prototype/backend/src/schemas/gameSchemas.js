/* ============================================================================
   Game JSON Zod Schemas (2D + 3D)
   ----------------------------------------------------------------------------
   These mirror the schemas defined in the system prompts (systemPrompt2D.js
   and systemPrompt3D.js on the frontend). They are used to validate the AI's
   output server-side before handing it back to the client.

   We use .passthrough() liberally so AI can return extra fields without
   us rejecting valid output — we validate what we care about.
   ========================================================================= */

const { z } = require('zod');
const {
  hexColorNumberSchema,
  hexColorStringSchema,
  position2DSchema,
  size2DSchema,
  platformSchema,
  position3DSchema,
  size3DSchema,
  vector3Schema,
  difficultyEnum,
  dimensionEnum,
  genre2DEnum,
  genre3DEnum,
  allGenresEnum,
  isoTimestampSchema
} = require('./commonSchemas');

// =================================================================
// Shared metadata
// =================================================================

const baseMetadataSchema = z.object({
  gameTitle: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  difficulty: difficultyEnum.optional(),
  estimatedPlaytime: z.string().optional(),
  version: z.string().optional(),
  createdAt: isoTimestampSchema.optional(),
  updatedAt: isoTimestampSchema.optional()
}).passthrough();

// =================================================================
// 2D GAME SCHEMAS
// =================================================================

const metadata2DSchema = baseMetadataSchema.extend({
  genre: genre2DEnum,
  engine: z.literal('phaser'),
  dimension: z.literal('2D')
});

const gameConfig2DSchema = z.object({
  width: z.number().int().min(200).max(1920).default(800),
  height: z.number().int().min(200).max(1080).default(600),
  backgroundColor: hexColorStringSchema,
  physics: z.object({
    system: z.string().default('arcade'),
    gravity: z.number().min(0).max(3000).default(800),
    debug: z.boolean().default(false)
  }).passthrough()
}).passthrough();

const player2DSchema = z.object({
  color: hexColorNumberSchema,
  speed: z.number().min(0).max(700),
  jumpVelocity: z.number().min(-1000).max(0).optional(),
  lives: z.number().int().min(1).max(10),
  size: size2DSchema.optional()
}).passthrough();

const enemies2DSchema = z.object({
  color: hexColorNumberSchema,
  count: z.number().int().min(0).max(30),
  spawnRate: z.number().int().min(100).max(10000).optional(),
  speed: z.number().min(0).max(500).optional(),
  behavior: z.string().optional()
}).passthrough();

const collectibles2DSchema = z.object({
  color: hexColorNumberSchema,
  count: z.number().int().min(0).max(50),
  value: z.number().int().min(0).max(1000).optional(),
  type: z.string().optional()
}).passthrough();

const level2DSchema = z.object({
  platforms: z.array(platformSchema).optional().default([]),
  obstacles: z.array(position2DSchema).optional().default([]),
  walls: z.array(z.string()).optional().default([]),
  theme: z.string().optional(),
  brickRows: z.number().int().optional(),
  brickCols: z.number().int().optional(),
  ballSpeed: z.number().optional()
}).passthrough();

const ui2DSchema = z.object({
  showScore: z.boolean().optional(),
  showLives: z.boolean().optional(),
  showTimer: z.boolean().optional(),
  showMinimap: z.boolean().optional(),
  fontFamily: z.string().optional(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional()
}).passthrough();

const controls2DSchema = z.object({
  scheme: z.enum(['arrows', 'wasd', 'both', 'mouse']).optional(),
  actionKey: z.string().optional()
}).passthrough();

const audio2DSchema = z.object({
  musicEnabled: z.boolean().optional(),
  sfxEnabled: z.boolean().optional(),
  theme: z.string().optional()
}).passthrough();

const gameJSON2DSchema = z.object({
  metadata: metadata2DSchema,
  gameConfig: gameConfig2DSchema,
  player: player2DSchema,
  enemies: enemies2DSchema.optional(),
  collectibles: collectibles2DSchema.optional(),
  level: level2DSchema.optional(),
  ui: ui2DSchema.optional(),
  controls: controls2DSchema.optional(),
  audio: audio2DSchema.optional()
}).passthrough();

// =================================================================
// 3D GAME SCHEMAS
// =================================================================

const metadata3DSchema = baseMetadataSchema.extend({
  genre: genre3DEnum,
  engine: z.literal('threejs'),
  dimension: z.literal('3D')
});

const fogSchema = z.object({
  enabled: z.boolean(),
  color: hexColorStringSchema,
  near: z.number().min(0),
  far: z.number().min(0)
}).passthrough().refine((d) => !d.enabled || d.far > d.near, {
  message: 'fog.far must be greater than fog.near when fog enabled'
});

const scene3DSchema = z.object({
  backgroundColor: hexColorStringSchema,
  fog: fogSchema.optional(),
  skybox: z.string().optional()
}).passthrough();

const camera3DSchema = z.object({
  type: z.enum(['first-person', 'third-person', 'top-down', 'side-view']),
  fov: z.number().min(30).max(120).default(75),
  near: z.number().min(0.01).default(0.1),
  far: z.number().min(10).default(500),
  initialPosition: position3DSchema
}).passthrough().refine((d) => d.far > d.near, {
  message: 'camera.far must be greater than camera.near'
});

const lighting3DSchema = z.object({
  ambient: z.object({
    color: hexColorStringSchema,
    intensity: z.number().min(0).max(2)
  }).passthrough(),
  directional: z.object({
    color: hexColorStringSchema,
    intensity: z.number().min(0).max(3),
    position: position3DSchema,
    castShadow: z.boolean().optional()
  }).passthrough(),
  mood: z.string().optional()
}).passthrough();

const player3DSchema = z.object({
  model: z.enum(['capsule', 'box', 'sphere']).optional(),
  color: hexColorNumberSchema,
  size: size3DSchema.optional(),
  moveSpeed: z.number().min(0).max(50),
  jumpForce: z.number().min(0).max(50).optional(),
  lives: z.number().int().min(1).max(10)
}).passthrough();

const physics3DSchema = z.object({
  gravity: vector3Schema.refine((v) => v.y <= 0, {
    message: 'gravity.y should be 0 or negative for downward force'
  }),
  playerCollider: z.string().optional()
}).passthrough();

const obstacle3DSchema = z.object({
  type: z.string(),
  position: position3DSchema,
  size: size3DSchema,
  color: hexColorNumberSchema,
  isStatic: z.boolean().optional()
}).passthrough();

const collectible3DSchema = z.object({
  type: z.string(),
  position: position3DSchema,
  color: hexColorNumberSchema,
  value: z.number().int().min(0).optional()
}).passthrough();

const world3DSchema = z.object({
  ground: z.object({
    type: z.string(),
    size: z.number().positive(),
    color: hexColorNumberSchema,
    texture: z.string().optional()
  }).passthrough(),
  obstacles: z.array(obstacle3DSchema).max(100).optional().default([]),
  collectibles: z.array(collectible3DSchema).max(100).optional().default([])
}).passthrough();

const enemies3DSchema = z.object({
  model: z.string().optional(),
  color: hexColorNumberSchema,
  count: z.number().int().min(0).max(30),
  spawnPositions: z.array(position3DSchema).optional().default([]),
  moveSpeed: z.number().min(0).max(50).optional(),
  behavior: z.string().optional()
}).passthrough();

const ui3DSchema = z.object({
  showCrosshair: z.boolean().optional(),
  showHUD: z.boolean().optional(),
  showCompass: z.boolean().optional(),
  showFPS: z.boolean().optional()
}).passthrough();

const controls3DSchema = z.object({
  scheme: z.enum(['fps', 'third-person', 'drive', 'fly']),
  mouseLook: z.boolean().optional(),
  actionKey: z.string().optional()
}).passthrough();

const gameJSON3DSchema = z.object({
  metadata: metadata3DSchema,
  scene: scene3DSchema,
  camera: camera3DSchema,
  lighting: lighting3DSchema,
  player: player3DSchema,
  physics: physics3DSchema,
  world: world3DSchema.optional(),
  enemies: enemies3DSchema.optional(),
  ui: ui3DSchema.optional(),
  controls: controls3DSchema
}).passthrough();

// =================================================================
// Discriminated union for any valid game
// =================================================================

const gameJSONSchema = z.union([
  gameJSON2DSchema.extend({ metadata: metadata2DSchema }),
  gameJSON3DSchema.extend({ metadata: metadata3DSchema })
], {
  errorMap: () => ({ message: 'gameJSON must have metadata.dimension of "2D" or "3D"' })
});

/**
 * Loose validator — just checks the bare minimum needed by the rest of the
 * pipeline (metadata.gameTitle/genre/dimension). Use this when you need to
 * accept "good enough" AI output without nitpicking every field.
 */
const looseGameJSONSchema = z.object({
  metadata: z.object({
    gameTitle: z.string().min(1),
    genre: allGenresEnum,
    engine: z.string(),
    dimension: dimensionEnum
  }).passthrough()
}).passthrough();

/**
 * Strict validator — full schema check, dimension-aware.
 * Throws if 2D game has 3D fields or vice versa.
 */
function validateGameJSONStrict(gameJSON) {
  if (!gameJSON?.metadata?.dimension) {
    throw new Error('gameJSON.metadata.dimension is required');
  }
  const schema = gameJSON.metadata.dimension === '3D' ? gameJSON3DSchema : gameJSON2DSchema;
  return schema.parse(gameJSON);
}

/**
 * Soft validator — returns { ok, errors } instead of throwing.
 * Useful inside the validation loop where we want to retry on failure.
 */
function validateGameJSONSafe(gameJSON, mode = 'loose') {
  const schema = mode === 'strict'
    ? (gameJSON?.metadata?.dimension === '3D' ? gameJSON3DSchema : gameJSON2DSchema)
    : looseGameJSONSchema;

  const result = schema.safeParse(gameJSON);
  if (result.success) return { ok: true, data: result.data };

  return {
    ok: false,
    errors: result.error.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message
    }))
  };
}

module.exports = {
  // Sub-schemas (for granular use)
  baseMetadataSchema,
  metadata2DSchema,
  metadata3DSchema,
  gameConfig2DSchema,
  player2DSchema,
  enemies2DSchema,
  collectibles2DSchema,
  level2DSchema,
  scene3DSchema,
  camera3DSchema,
  lighting3DSchema,
  player3DSchema,
  physics3DSchema,
  world3DSchema,
  enemies3DSchema,
  // Top-level
  gameJSON2DSchema,
  gameJSON3DSchema,
  gameJSONSchema,
  looseGameJSONSchema,
  // Helpers
  validateGameJSONStrict,
  validateGameJSONSafe
};
