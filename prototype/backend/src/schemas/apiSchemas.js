/* ============================================================================
   API Request Schemas
   ========================================================================= */

const { z } = require('zod');
const { GENERATION } = require('../config/constants');
const {
  allGenresEnum,
  dimensionEnum
} = require('./commonSchemas');
const { looseGameJSONSchema } = require('./gameSchemas');

const promptSchema = z.string()
  .trim()
  .min(1, 'prompt cannot be empty')
  .max(GENERATION.MAX_PROMPT_LENGTH, `prompt too long (max ${GENERATION.MAX_PROMPT_LENGTH} chars)`);

const editPromptSchema = z.string()
  .trim()
  .min(1, 'editPrompt cannot be empty')
  .max(GENERATION.MAX_EDIT_PROMPT_LENGTH, `editPrompt too long (max ${GENERATION.MAX_EDIT_PROMPT_LENGTH} chars)`);

const modelSchema = z.string().trim().min(1).max(120).optional();

const systemPromptSchema = z.string()
  .min(1, 'systemPrompt cannot be empty')
  .max(20000, 'systemPrompt too long (max 20000 chars)');

const openaiRequestSchema = z.object({
  prompt: promptSchema,
  systemPrompt: systemPromptSchema.optional(),
  model: modelSchema,
  format: z.enum(['json', 'text']).default('json')
});

const mcqGenerateSchema = z.object({
  prompt: promptSchema,
  gameType: allGenresEnum.optional(),
  dimension: dimensionEnum.optional(),
  model: modelSchema
});

const generateGameSchema = z.object({
  prompt: promptSchema,
  answers: z.record(z.string()).optional().default({}),
  gameType: allGenresEnum,
  dimension: dimensionEnum,
  systemPrompt: systemPromptSchema.optional(),
  model: modelSchema
});

const editGameSchema = z.object({
  gameJSON: looseGameJSONSchema,
  editPrompt: editPromptSchema,
  systemPrompt: systemPromptSchema.optional(),
  model: modelSchema
});

const mcqOptionSchema = z.object({
  id: z.string().min(1).max(10),
  label: z.string().min(1).max(140),
  value: z.string().min(1).max(200)
});

const mcqQuestionSchema = z.object({
  id: z.string().min(1).max(80),
  question: z.string().min(1).max(180),
  options: z.array(mcqOptionSchema).min(2).max(5)
});

const mcqQuestionsSchema = z.object({
  questions: z.array(mcqQuestionSchema).min(2).max(10)
});

const gameBriefGenerateSchema = z.object({
  prompt: promptSchema,
  answers: z.record(z.string()).optional().default({}),
  gameType: allGenresEnum.optional(),
  dimension: dimensionEnum.optional(),
  existingAssets: z.array(z.object({
    id: z.string().min(1).max(120),
    name: z.string().min(1).max(200),
    type: z.string().min(1).max(80).optional(),
    tags: z.array(z.string().min(1).max(80)).max(20).optional()
  })).max(50).optional().default([]),
  model: modelSchema
});

const gameBriefContentSchema = z.object({
  title: z.string().min(1).max(120),
  oneSentencePitch: z.string().min(1).max(300),
  playerFantasy: z.string().min(1).max(300),
  targetPlatform: z.enum(['mobile-first', 'desktop-first', 'cross-platform']).default('mobile-first'),
  dimension: z.enum(['2D', '3D', 'hybrid']),
  genre: z.string().min(1).max(80),
  coreLoop: z.array(z.string().min(1).max(160)).min(3).max(6),
  keyMechanics: z.array(z.string().min(1).max(160)).min(3).max(8),
  controls: z.object({
    primary: z.string().min(1).max(160),
    mobile: z.string().min(1).max(160),
    accessibilityNotes: z.array(z.string().min(1).max(180)).max(5).default([])
  }),
  runtimePlan: z.object({
    runtime: z.literal('hybrid'),
    phaserRole: z.string().min(1).max(240),
    threeRole: z.string().min(1).max(240),
    rapierRole: z.string().min(1).max(240),
    godotStyleGenerationNotes: z.string().min(1).max(300),
    systems: z.array(z.string().min(1).max(80)).min(2).max(12)
  }),
  assetPlan: z.object({
    existingAssetsToUse: z.array(z.string().min(1).max(160)).max(20).default([]),
    assetsToGenerate: z.array(z.string().min(1).max(160)).min(1).max(20),
    visualStyle: z.string().min(1).max(220)
  }),
  missingInfo: z.array(z.string().min(1).max(180)).max(10).default([]),
  followUpQuestions: z.array(mcqQuestionSchema).min(3).max(6),
  productionNotes: z.array(z.string().min(1).max(220)).min(2).max(8),
  nonGoals: z.array(z.string().min(1).max(160)).min(1).max(5)
});

const gameBriefSchema = z.object({
  brief: gameBriefContentSchema
});

const engineFromBriefGenerateSchema = z.object({
  prompt: promptSchema.optional(),
  answers: z.record(z.string()).optional().default({}),
  gameType: allGenresEnum.optional(),
  dimension: dimensionEnum.optional(),
  brief: gameBriefContentSchema,
  selectedAssetIds: z.array(z.string().min(1).max(180)).max(20).optional().default([]),
  model: modelSchema
});

module.exports = {
  promptSchema,
  editPromptSchema,
  modelSchema,
  systemPromptSchema,
  openaiRequestSchema,
  mcqGenerateSchema,
  gameBriefGenerateSchema,
  engineFromBriefGenerateSchema,
  generateGameSchema,
  editGameSchema,
  mcqQuestionsSchema,
  gameBriefContentSchema,
  gameBriefSchema
};
