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

function buildLegacyMCQPrompt({ prompt, gameType, dimension }) {
  const parts = [];
  parts.push(`USER GAME IDEA: ${prompt}`);
  if (gameType) parts.push(`KNOWN GAME TYPE: ${gameType}`);
  if (dimension) parts.push(`KNOWN DIMENSION: ${dimension}`);
  parts.push('');
  parts.push('Analyze THIS specific game idea. Identify what is genuinely ambiguous, unknowable, or design-critical for THIS idea — not generic categories.');
  parts.push('A roguelike, a rhythm game, a horror game, a puzzle, and a racing game each have different unknowns. Tailor your questions to the unique nature of the idea above.');
  parts.push('Skip questions whose answer is obvious from the prompt or trivially defaulted. If only 2 things are truly unknown, ask only 2 questions. If 9 things matter, ask 9.');
  parts.push('Avoid asking about: dimension/2D-vs-3D, mobile orientation, art-asset source, or generic difficulty UNLESS the prompt makes one of these genuinely load-bearing for THIS idea.');
  parts.push('Prefer surprising, idea-specific questions over a checklist. Each question should make the designer think "huh, good catch".');
  parts.push('Return JSON only.');
  return parts.join('\n');
}

function buildHybridMinimalMCQPrompt({ prompt, gameType, dimension }) {
  const parts = [];
  parts.push(`USER GAME IDEA: ${prompt}`);
  if (gameType) parts.push(`KNOWN GAME TYPE: ${gameType}`);
  if (dimension) parts.push(`KNOWN DIMENSION: ${dimension}`);
  parts.push('');
  parts.push('Ask sharp, idea-native questions for this specific game.');
  parts.push('Avoid covering the whole game; choose only the decisions that matter for the first playable version.');
  parts.push('Prefer concrete forks in gameplay, structure, or player fantasy over generic categories.');
  parts.push('Return JSON only.');
  return parts.join('\n');
}

function buildGameBriefPrompt({ prompt, answers = {}, gameType, dimension, existingAssets = [] }) {
  const parts = [];
  parts.push(`RAW USER GAME IDEA: ${prompt}`);
  if (gameType) parts.push(`KNOWN GAME TYPE: ${gameType}`);
  if (dimension) parts.push(`KNOWN DIMENSION: ${dimension}`);

  const answerEntries = Object.entries(answers || {});
  if (answerEntries.length) {
    parts.push('QUESTION ANSWERS:');
    for (const [key, value] of answerEntries.slice(0, 20)) {
      parts.push(`- ${key}: ${value}`);
    }
  }

  if (existingAssets.length) {
    parts.push('AVAILABLE EXISTING ASSETS:');
    for (const asset of existingAssets.slice(0, 20)) {
      const tags = Array.isArray(asset.tags) && asset.tags.length ? ` tags=${asset.tags.slice(0, 6).join(',')}` : '';
      parts.push(`- ${asset.id}: ${asset.name}${asset.type ? ` (${asset.type})` : ''}${tags}`);
    }
  }

  parts.push('');
  parts.push('Create a production-ready Game Brief for planning only.');
  parts.push('Do not generate full game code.');
  parts.push('Always include 3-6 follow-up questions.');
  parts.push('Do not omit followUpQuestions even if the brief feels complete.');
  parts.push('Use MCQ answers as fixed decisions; ask only remaining first-playable decisions.');
  parts.push('Keep runtime systems, production notes, non-goals, and visual style concise enough to pass the schema on the first response.');
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
  buildMCQPrompt: buildHybridMinimalMCQPrompt,
  buildGameBriefPrompt,
  buildGenericJSONPrompt
};
