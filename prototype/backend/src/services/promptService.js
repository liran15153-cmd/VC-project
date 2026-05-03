/* ============================================================================
   Prompt Service
   ----------------------------------------------------------------------------
   Builds user-side prompts that pair with the frontend's system prompts.
   The system prompt (SYSTEM_PROMPT_2D / 3D) is sent from the frontend.
   We assemble the user message that pushes the AI into the right shape.
   ========================================================================= */

/**
 * Build a user prompt for game generation.
 */
function buildGenerationPrompt({ prompt, answers = {}, gameType, dimension }) {
  const parts = [];
  parts.push(`USER PROMPT: ${prompt}`);
  parts.push(`DETECTED GAME TYPE: ${gameType}`);
  parts.push(`DIMENSION: ${dimension}`);

  if (answers && Object.keys(answers).length > 0) {
    parts.push('USER MCQ ANSWERS (apply ALL of these):');
    for (const [key, value] of Object.entries(answers)) {
      parts.push(`  - ${key}: ${value}`);
    }
  }

  parts.push('');
  parts.push('Return ONLY a single JSON object that conforms to the schema in the system prompt.');
  parts.push('Run the validation loop before returning.');
  parts.push('Do NOT include markdown, prose, or explanations — only JSON.');

  return parts.join('\n');
}

function buildMCQPrompt({ prompt, gameType, dimension }) {
  const parts = [];
  parts.push(`USER GAME IDEA: ${prompt}`);
  if (gameType) parts.push(`KNOWN GAME TYPE: ${gameType}`);
  if (dimension) parts.push(`KNOWN DIMENSION: ${dimension}`);
  parts.push('');
  parts.push('Generate the best clarifying MCQ questions for this idea.');
  parts.push('Return JSON only.');
  return parts.join('\n');
}

/**
 * Build a user prompt for editing an existing game.
 */
function buildEditPrompt({ gameJSON, editPrompt }) {
  return [
    'You are editing an existing game. Apply ONLY the requested changes.',
    'Preserve game identity (title, genre, dimension) unless the edit explicitly asks to change them.',
    '',
    'EXISTING GAME JSON:',
    JSON.stringify(gameJSON, null, 2),
    '',
    `EDIT REQUEST: ${editPrompt}`,
    '',
    'Return the COMPLETE modified JSON (not a diff). Run the validation loop.',
    'Output ONLY the JSON.'
  ].join('\n');
}

/**
 * Build a generic JSON-mode prompt for the admin-only OpenAI route.
 */
function buildGenericJSONPrompt({ task, schema, examples }) {
  const parts = [`TASK: ${task}`];
  if (schema) parts.push(`OUTPUT SCHEMA:\n${schema}`);
  if (examples) parts.push(`EXAMPLES:\n${examples}`);
  parts.push('Return ONLY valid JSON. No markdown, no prose.');
  return parts.join('\n\n');
}

module.exports = {
  buildGenerationPrompt,
  buildEditPrompt,
  buildMCQPrompt,
  buildGenericJSONPrompt
};
