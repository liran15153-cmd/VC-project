/* ============================================================================
   Common Zod Building Blocks
   ----------------------------------------------------------------------------
   Reusable primitives shared across game and API schemas.
   ========================================================================= */

const { z } = require('zod');

// =================================================================
// Colors
// =================================================================

/** Hex color as a number (0xRRGGBB) — what Phaser/Three.js use internally. */
const hexColorNumberSchema = z.number()
  .int()
  .min(0)
  .max(0xffffff);

/** Hex color as a CSS string ("#RRGGBB"). */
const hexColorStringSchema = z.string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Must be hex color like "#a855f7"');

// =================================================================
// 2D primitives
// =================================================================

const position2DSchema = z.object({
  x: z.number(),
  y: z.number()
});

const size2DSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive()
});

const platformSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive()
});

// =================================================================
// 3D primitives
// =================================================================

const position3DSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number()
});

const size3DSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
  depth: z.number().positive()
});

const vector3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number()
});

// =================================================================
// Enums (kept loose so frontend can extend without breaking server)
// =================================================================

const difficultyEnum = z.enum(['easy', 'medium', 'hard']);
const dimensionEnum = z.enum(['2D', '3D']);

const genres2D = ['platformer', 'shooter', 'runner', 'breakout', 'rpg', 'puzzle'];
const genres3D = ['explorer-fp', 'adventure-tp', 'platformer-3d', 'runner-3d', 'racing', 'flying'];
const allGenres = [...genres2D, ...genres3D];

const genre2DEnum = z.enum(genres2D);
const genre3DEnum = z.enum(genres3D);
const allGenresEnum = z.enum(allGenres);

// =================================================================
// Identifiers
// =================================================================

const gameIdSchema = z.string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/, 'id must be alphanumeric/underscore/hyphen');

const userIdSchema = z.string()
  .min(1)
  .max(100);

// =================================================================
// Timestamps
// =================================================================

const isoTimestampSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}/, 'must be ISO 8601 timestamp')
  .or(z.string().datetime());

module.exports = {
  // colors
  hexColorNumberSchema,
  hexColorStringSchema,
  // 2D
  position2DSchema,
  size2DSchema,
  platformSchema,
  // 3D
  position3DSchema,
  size3DSchema,
  vector3Schema,
  // enums
  difficultyEnum,
  dimensionEnum,
  genre2DEnum,
  genre3DEnum,
  allGenresEnum,
  genres2D,
  genres3D,
  allGenres,
  // ids
  gameIdSchema,
  userIdSchema,
  // time
  isoTimestampSchema
};
