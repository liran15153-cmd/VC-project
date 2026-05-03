/* ============================================================================
   Server-owned AI System Prompts
   ========================================================================= */

function getGameSystemPrompt(dimension) {
  if (dimension === '3D') return GAME_3D_SYSTEM_PROMPT;
  return GAME_2D_SYSTEM_PROMPT;
}

const COMMON_RULES = `
You generate production-ready game configuration JSON for Gaming Vibe Coding.
Return one JSON object only. No markdown, no prose, no comments.
All numbers must be finite. Colors for runtime fields must be either 0xRRGGBB numbers or "#RRGGBB" strings as requested.
Keep the game playable in a browser template without external custom assets.
`;

const GAME_2D_SYSTEM_PROMPT = `${COMMON_RULES}
You must return a JSON object that matches this schema, but adapt the values (colors, speeds, sizes, behaviors, etc.) creatively based on the user's request.

Required JSON Schema:
{
  "metadata": {
    "gameTitle": "string (creative name based on prompt)",
    "description": "string",
    "genre": "platformer|shooter|runner|breakout|rpg|puzzle",
    "engine": "phaser",
    "dimension": "2D",
    "difficulty": "easy|medium|hard",
    "estimatedPlaytime": "string"
  },
  "gameConfig": {
    "width": "number",
    "height": "number",
    "backgroundColor": "string (hex color)",
    "physics": { "system": "arcade", "gravity": "number", "debug": "boolean" }
  },
  "player": { 
    "color": "number (0xRRGGBB)", 
    "speed": "number", 
    "jumpVelocity": "number", 
    "lives": "number", 
    "size": { "width": "number", "height": "number" } 
  },
  "enemies": { 
    "color": "number (0xRRGGBB)", 
    "count": "number", 
    "spawnRate": "number", 
    "speed": "number", 
    "behavior": "string (e.g. patrol, chase, stationary)" 
  },
  "collectibles": { 
    "color": "number (0xRRGGBB)", 
    "count": "number", 
    "value": "number", 
    "type": "string (e.g. coin, gem, star)" 
  },
  "level": { 
    "platforms": [{"x": "number", "y": "number", "width": "number"}], 
    "theme": "string" 
  },
  "ui": { "showScore": "boolean", "showLives": "boolean", "showTimer": "boolean" },
  "controls": { "scheme": "string", "actionKey": "string" },
  "audio": { "musicEnabled": "boolean", "sfxEnabled": "boolean", "theme": "string" }
}
}`;

const GAME_3D_SYSTEM_PROMPT = `${COMMON_RULES}
You must return a JSON object that matches this schema, but adapt the values creatively based on the user's request.

Required JSON Schema:
{
  "metadata": {
    "gameTitle": "string",
    "description": "string",
    "genre": "explorer-fp|adventure-tp|platformer-3d|runner-3d|racing|flying",
    "engine": "threejs",
    "dimension": "3D",
    "difficulty": "easy|medium|hard",
    "estimatedPlaytime": "string"
  },
  "scene": { "backgroundColor": "string", "fog": { "enabled": "boolean", "color": "string", "near": "number", "far": "number" } },
  "camera": { "type": "third-person|first-person", "fov": "number", "near": "number", "far": "number", "initialPosition": { "x": "number", "y": "number", "z": "number" } },
  "lighting": {
    "ambient": { "color": "string", "intensity": "number" },
    "directional": { "color": "string", "intensity": "number", "position": { "x": "number", "y": "number", "z": "number" }, "castShadow": "boolean" },
    "mood": "string"
  },
  "player": { "model": "string", "color": "number (0xRRGGBB)", "size": { "width": "number", "height": "number", "depth": "number" }, "moveSpeed": "number", "jumpForce": "number", "lives": "number" },
  "physics": { "gravity": { "x": "number", "y": "number", "z": "number" }, "playerCollider": "string" },
  "world": {
    "ground": { "type": "plane", "size": "number", "color": "number (0xRRGGBB)" },
    "obstacles": [{"type": "string", "position": {"x":"number","y":"number","z":"number"}}],
    "collectibles": [{"type": "string", "position": {"x":"number","y":"number","z":"number"}}]
  },
  "enemies": { "model": "string", "color": "number (0xRRGGBB)", "count": "number", "spawnPositions": [], "moveSpeed": "number", "behavior": "string" },
  "ui": { "showCrosshair": "boolean", "showHUD": "boolean", "showCompass": "boolean", "showFPS": "boolean" },
  "controls": { "scheme": "string", "mouseLook": "boolean", "actionKey": "string" }
}
}`;

const MCQ_SYSTEM_PROMPT = `
You generate clarifying multiple-choice questions for no-code game creation.
Return JSON only in this exact shape:
{
  "questions": [
    {
      "id": "short_snake_case",
      "question": "Clear user-facing question",
      "options": [
        { "id": "A", "label": "Short answer", "value": "machine_readable_value" },
        { "id": "B", "label": "Short answer", "value": "machine_readable_value" }
      ]
    }
  ]
}
Rules:
- Generate 5 to 8 questions.
- Each question has 1 or 2 options, prefer 2.
- Ask only questions that materially change game generation.
- Keep wording friendly for non-technical users.
`;

module.exports = { getGameSystemPrompt, MCQ_SYSTEM_PROMPT };
