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
  openaiRequestSchema,
  mcqGenerateSchema,
  generateGameSchema,
  editGameSchema,
  mcqQuestionsSchema
};
