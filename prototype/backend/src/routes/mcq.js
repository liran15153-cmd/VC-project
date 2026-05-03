/* ============================================================================
   MCQ Generation Routes
   ========================================================================= */

const express = require('express');
const validate = require('../middleware/validate');
const { mcqGenerateSchema, mcqQuestionsSchema } = require('../schemas/apiSchemas');
const { generateJSON } = require('../services/openaiService');
const { buildMCQPrompt } = require('../services/promptService');
const { MCQ_SYSTEM_PROMPT } = require('../services/systemPrompts');
const fallbackAI = require('../services/fallbackAIService');
const config = require('../config/env');
const { ExternalAPIError } = require('../utils/errors');

const router = express.Router();

async function generateMCQOrFallback({ prompt, gameType, dimension, model }) {
  try {
    const result = await generateJSON({
      systemPrompt: MCQ_SYSTEM_PROMPT,
      prompt: buildMCQPrompt({ prompt, gameType, dimension }),
      model,
      generationConfig: { temperature: 0.55, maxOutputTokens: 1500 }
    });

    const parsed = mcqQuestionsSchema.safeParse(result.json);
    if (!parsed.success) {
      throw new ExternalAPIError(config.ai.providerLabel, `Invalid MCQ JSON: ${parsed.error.issues.map(i => `${i.path.join('.')}:${i.message}`).join(', ')}`);
    }

    return {
      questions: parsed.data.questions,
      model: result.model,
      durationMs: result.durationMs,
      fallback: false
    };
  } catch (err) {
    if (!config.ai.fallbackEnabled || !fallbackAI.shouldUseFallback(err)) throw err;

    const fallback = fallbackAI.generateMCQ({ prompt, gameType, dimension });
    const parsed = mcqQuestionsSchema.parse({ questions: fallback.questions });
    return {
      questions: parsed.questions,
      model: 'local-fallback',
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
        fallbackReason: result.fallbackReason
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
