/* ============================================================================
   API Request Schemas
   ========================================================================= */

const { z } = require('zod');
const { GENERATION } = require('../config/constants');
const {
  allGenresEnum,
  dimensionEnum,
  userIdSchema,
  gameIdSchema
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

const emailSchema = z.string().trim().toLowerCase().email().max(320);
const passwordSchema = z.string()
  .min(8, 'password must be at least 8 characters')
  .max(200, 'password too long');

const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1).max(120).optional()
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200)
});

const tokenGrantSchema = z.object({
  userId: userIdSchema,
  amount: z.coerce.number().int().min(1).max(100000)
});

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
  model: modelSchema,
  saveToDb: z.boolean().optional().default(true),
  userId: userIdSchema.optional()
});

const editGameSchema = z.object({
  gameId: gameIdSchema.optional(),
  gameJSON: looseGameJSONSchema.optional(),
  editPrompt: editPromptSchema,
  systemPrompt: systemPromptSchema.optional(),
  model: modelSchema,
  saveToDb: z.boolean().optional().default(true)
}).refine((data) => data.gameId || data.gameJSON, {
  message: 'gameId or gameJSON must be provided'
});

const gameCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional(),
  gameJSON: looseGameJSONSchema,
  htmlString: z.string().max(2_000_000).optional(),
  thumbnailUrl: z.string().max(2000).optional(),
  assetManifest: z.array(z.record(z.any())).optional(),
  prompt: z.string().max(GENERATION.MAX_PROMPT_LENGTH).optional(),
  mcqAnswers: z.record(z.string()).optional(),
  userId: userIdSchema.optional(),
  isPublished: z.boolean().optional()
});

const gameUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  gameJSON: looseGameJSONSchema.optional(),
  htmlString: z.string().max(2_000_000).optional(),
  thumbnailUrl: z.string().max(2000).optional(),
  assetManifest: z.array(z.record(z.any())).optional(),
  prompt: z.string().max(GENERATION.MAX_PROMPT_LENGTH).optional(),
  mcqAnswers: z.record(z.string()).optional(),
  isPublished: z.boolean().optional()
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided'
});

const gameQuerySchema = z.object({
  userId: userIdSchema.optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100).optional(),
  offset: z.coerce.number().int().min(0).default(0).optional(),
  orderBy: z.enum(['updated_at', 'created_at', 'title']).default('updated_at').optional()
});

const idParamSchema = z.object({
  id: gameIdSchema
});

const statsEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50).optional()
});

const mcqOptionSchema = z.object({
  id: z.string().min(1).max(10),
  label: z.string().min(1).max(300),
  value: z.string().min(1).max(200)
});

const mcqQuestionSchema = z.object({
  id: z.string().min(1).max(80),
  question: z.string().min(1).max(500),
  options: z.array(mcqOptionSchema).min(1).max(2)
});

const mcqQuestionsSchema = z.object({
  questions: z.array(mcqQuestionSchema).min(5).max(8)
});

module.exports = {
  promptSchema,
  editPromptSchema,
  modelSchema,
  systemPromptSchema,
  registerSchema,
  loginSchema,
  tokenGrantSchema,
  openaiRequestSchema,
  mcqGenerateSchema,
  generateGameSchema,
  editGameSchema,
  gameCreateSchema,
  gameUpdateSchema,
  gameQuerySchema,
  idParamSchema,
  statsEventsQuerySchema,
  mcqQuestionsSchema
};
