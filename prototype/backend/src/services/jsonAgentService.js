/* ============================================================================
   Schema-Validated JSON Agent Helper
   ========================================================================= */

const { generateJSON } = require('./openaiService');
const { ExternalAPIError } = require('../utils/errors');
const config = require('../config/env');

function formatZodIssues(error) {
  return error.issues.map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`).join('; ');
}

async function generateValidatedJSON({
  schema,
  systemPrompt,
  prompt,
  model,
  generationConfig,
  cacheKey,
  repairLabel = 'JSON'
}) {
  const first = await generateJSON({
    systemPrompt,
    prompt,
    model,
    generationConfig,
    cacheKey
  });

  const parsed = schema.safeParse(first.json);
  if (parsed.success) {
    return { ...first, json: parsed.data, schemaRepair: false };
  }

  const reason = formatZodIssues(parsed.error);
  const repaired = await generateJSON({
    systemPrompt,
    prompt: [
      prompt,
      '',
      `The previous ${repairLabel} response was valid JSON but failed schema validation:`,
      reason,
      '',
      'Return one corrected JSON object that satisfies the required schema. JSON only.'
    ].join('\n'),
    model,
    generationConfig: {
      ...generationConfig,
      temperature: Math.min(generationConfig?.temperature ?? 0.4, 0.3),
      maxOutputTokens: Math.min(
        Math.max(generationConfig?.maxOutputTokens ?? 2500, 3500) + 1500,
        config.ai.hardMaxOutputTokens
      )
    },
    cacheKey: `${cacheKey || prompt}:schema-repair:${reason}`,
    allowCache: false
  });

  const repairParsed = schema.safeParse(repaired.json);
  if (repairParsed.success) {
    return {
      ...repaired,
      json: repairParsed.data,
      schemaRepair: true,
      originalValidationError: reason
    };
  }

  throw new ExternalAPIError(
    config.ai.providerLabel,
    `Invalid ${repairLabel} JSON after repair: ${formatZodIssues(repairParsed.error)}`
  );
}

module.exports = {
  generateValidatedJSON,
  formatZodIssues
};
