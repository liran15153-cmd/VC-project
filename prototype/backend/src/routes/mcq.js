/* ============================================================================
   MCQ Generation Routes
   ========================================================================= */

const express = require('express');
const validate = require('../middleware/validate');
const { mcqGenerateSchema, mcqQuestionsSchema } = require('../schemas/apiSchemas');
const { buildMCQPrompt } = require('../services/promptService');
const { MCQ_SYSTEM_PROMPT } = require('../services/systemPrompts');
const fallbackAI = require('../services/fallbackAIService');
const { generateValidatedJSON } = require('../services/jsonAgentService');
const { shouldUseMockForTask } = require('../services/aiModeService');
const config = require('../config/env');

const router = express.Router();

async function generateMCQOrFallback({ prompt, gameType, dimension, model }) {
  if (shouldUseMockForTask('mcq', { prompt, gameType, dimension })) {
    const mock = fallbackAI.generateMCQ({ prompt, gameType, dimension });
    const parsed = mcqQuestionsSchema.parse({ questions: mock.questions });
    return {
      questions: parsed.questions,
      model: 'local-mock',
      durationMs: 0,
      fallback: false,
      mode: config.ai.mode,
      tokenOptimized: true
    };
  }

  try {
    const result = await generateValidatedJSON({
      schema: mcqQuestionsSchema,
      systemPrompt: MCQ_SYSTEM_PROMPT,
      prompt: buildMCQPrompt({ prompt, gameType, dimension }),
      model,
      generationConfig: { temperature: 0.85, maxOutputTokens: 3200 },
      cacheKey: { task: 'mcq', prompt, gameType, dimension, model },
      repairLabel: 'MCQ questions'
    });

    return {
      questions: result.json.questions,
      model: result.model,
      durationMs: result.durationMs,
      fallback: false,
      schemaRepair: result.schemaRepair,
      cached: result.cached,
      tokenOptimization: result.tokenOptimization
    };
  } catch (err) {
    if (!config.ai.fallbackEnabled || !fallbackAI.shouldUseFallback(err)) throw err;

    const fallback = fallbackAI.generateMCQ({ prompt, gameType, dimension });
    const parsed = mcqQuestionsSchema.parse({ questions: fallback.questions });
    return {
      questions: parsed.questions,
      model: 'local-mock',
      durationMs: 0,
      fallback: true,
      fallbackReason: err.message
    };
  }
}

router.post('/generate', validate(mcqGenerateSchema), async (req, res, next) => {
  const { prompt, gameType, dimension, model } = req.body;

  try {
    const result = await generateMCQOrFallback({ prompt, gameType, dimension, model });

    res.json({
      questions: result.questions,
      meta: {
        provider: config.ai.provider,
        model: result.model,
        durationMs: result.durationMs,
        fallback: result.fallback,
        fallbackReason: result.fallbackReason,
        mode: config.ai.mode,
        tokenOptimized: result.tokenOptimized,
        schemaRepair: result.schemaRepair,
        cached: result.cached,
        tokenOptimization: result.tokenOptimization
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
