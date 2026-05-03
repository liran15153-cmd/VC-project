/* ============================================================================
   GAME_ENGINE Prompt Service
   ----------------------------------------------------------------------------
   Prompts the configured AI provider to emit the declarative GameDefinition runtime format used by
   GAME_ENGINE, not the older prototype game JSON shape.
   ========================================================================= */

const ENGINE_CAPABILITIES = Object.freeze({
  schemaVersion: 1,
  assetTypes: ['image', 'spritesheet', 'atlas', 'tilemap', 'gltf', 'audio', 'json', 'text', 'arrayBuffer'],
  meshShapes: ['box', 'sphere', 'plane', 'cylinder', 'cone', 'torus'],
  colliderShapes: ['cuboid', 'ball', 'capsule'],
  systems: ['physicsSync', 'camera', 'behavior', 'tween', 'spawner', 'ui', 'audio'],
  triggers: ['sceneStart', 'inputPressed', 'inputDown', 'inputReleased', 'keyDown', 'keyUp', 'collision', 'stateChange', 'timer', 'event'],
  actions: [
    'setState',
    'incrementState',
    'decrementState',
    'switchScene',
    'spawnPrefab',
    'destroyEntity',
    'applyImpulse',
    'setVelocity',
    'setVelocityX',
    'setVelocityY',
    'setVelocityZ',
    'setPosition',
    'translate',
    'playSound',
    'emitEvent',
    'addTag',
    'removeTag'
  ],
  selectors: ['entityKey', 'tag', 'self', 'other', 'collisionOther', 'collisionA', 'collisionB', 'all'],
  uiTypes: ['text', 'bar'],
  lightTypes: ['ambient', 'directional', 'point'],
  tweenProperties: ['position.x', 'position.y', 'position.z', 'scale.x', 'scale.y', 'scale.z', 'rotation.x', 'rotation.y', 'rotation.z']
});

const ENGINE_GAME_SYSTEM_PROMPT = `
You generate playable declarative JSON for Gaming Vibe Coding's GAME_ENGINE runtime.
Return exactly one JSON object. No markdown, no prose, no comments, no code fences.

CRITICAL OUTPUT FORMAT:
- Use the GAME_ENGINE GameDefinition format only.
- Do not emit the old prototype format: no metadata.gameTitle, no gameConfig, no free JavaScript code blocks.
- Do not generate JavaScript, TypeScript, HTML, CSS, shader code, or unsafe script strings.
- Only use the capabilities listed below.
- Keep games browser-playable with primitive meshes unless the prompt explicitly asks for existing assets.
- If the user's game idea asks for a feature not supported yet, approximate it with supported primitives and explain the limitation in metadata.description.

SUPPORTED CAPABILITIES:
${JSON.stringify(ENGINE_CAPABILITIES, null, 2)}

REQUIRED TOP-LEVEL SHAPE:
{
  "schemaVersion": 1,
  "metadata": {
    "title": "short playable game title",
    "description": "what was generated and any limitations",
    "genre": "string",
    "estimatedPlaytime": "2-5 minutes"
  },
  "engine": {
    "width": 960,
    "height": 540,
    "enable3D": true,
    "enable2D": true,
    "enablePhysics": true,
    "gravity": { "x": 0, "y": -12, "z": 0 },
    "background": "#111827"
  },
  "state": {},
  "inputBindings": {},
  "assets": [],
  "prefabs": {},
  "behaviors": [],
  "animations": [],
  "ui": [],
  "audio": [],
  "scenes": [],
  "initialScene": "main"
}

MINIMUM PLAYABILITY RULES:
- Include at least one playable "main" scene.
- Include a player entity with key "player", tag "player", a mesh, a dynamic rigidBody, and cameraTarget.
- Include a static ground/platform with a collider.
- Include inputBindings for movement and at least one action:
  moveLeft -> ["ArrowLeft", "KeyA"]
  moveRight -> ["ArrowRight", "KeyD"]
  jump -> ["Space", "ArrowUp", "KeyW"]
- Include behaviors for movement. Platformer-like games should use setVelocityX and applyImpulse.
- Include a win or lose condition using state, collision, timer, or scene switching.
- Include UI text that reflects state, such as Score: {score}, Lives: {lives}, Time: {time}, or Goal: {goal}.
- Add "physicsSync" and "camera" to every playable scene's systems. Add behavior, spawner, tween, ui, or audio only when used.

RUNTIME NOTES:
- Gravity uses Y-up 3D coordinates; downward gravity is negative Y.
- Colliders use halfExtents for cuboids.
- Sensor collectibles should use colliderOptions: { "sensor": true }.
- To remove a collided collectible/hazard, use target "collisionOther".
- switchScene actions must point to an existing scene key.
- Spawners must reference a prefab key that exists in prefabs.
- Entity keys must be unique within each scene.
- Use colors as "#RRGGBB" strings for readability.
`;

const PALETTE_OPTIONS = [
  'bright neon colors on dark background',
  'pastel soft tones on light background',
  'earthy warm browns and oranges',
  'deep ocean blues and teals',
  'fiery reds and yellows',
  'monochrome with one accent color',
  'purple and gold royalty palette',
  'forest greens and stone grays',
];

const GENRE_HINTS = [
  'Give the player a sense of urgency with a countdown timer.',
  'Use a spawner to create waves of enemies.',
  'Include a win scene and a lose scene with different messages.',
  'Add a collectible that restores lives.',
  'Make the environment hostile — hazards that kill on contact.',
  'Give enemies a patrol between two points.',
  'Scale difficulty by spawning more enemies as score increases.',
  'Add a jump-pad or bouncy platform.',
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildEngineGenerationPrompt({ prompt }) {
  const palette = pick(PALETTE_OPTIONS);
  const hint = pick(GENRE_HINTS);
  const seed = Math.floor(Math.random() * 9000) + 1000;

  return [
    `USER GAME IDEA: ${prompt}`,
    '',
    'Generate one complete GAME_ENGINE GameDefinition JSON object.',
    '',
    'DIVERSITY REQUIREMENTS (apply all of these):',
    `- Seed: ${seed} — use this to make your output unique and not a copy of any previous game.`,
    `- Color palette: ${palette}. Apply consistently to player, enemies, ground, and background.`,
    `- Gameplay twist: ${hint}`,
    '- Choose entity sizes, positions, and physics values that match the prompt theme — do NOT just use the defaults.',
    '- Give the game a distinct title derived from the prompt (not "Game" or "Demo").',
    '- The scene layout (platform positions, entity placement) must reflect the prompt theme.',
    '',
    'Prefer simple, robust mechanics over complex unsupported features.',
    'Return valid JSON only.'
  ].join('\n');
}

function buildEngineCorrectionPrompt({ originalPrompt, validationReason }) {
  return [
    buildEngineGenerationPrompt({ prompt: originalPrompt }),
    '',
    `PREVIOUS ATTEMPT FAILED GAME_ENGINE VALIDATION: ${validationReason}`,
    'Fix the JSON so it validates and remains playable. Return JSON only.'
  ].join('\n');
}

module.exports = {
  ENGINE_CAPABILITIES,
  ENGINE_GAME_SYSTEM_PROMPT,
  buildEngineGenerationPrompt,
  buildEngineCorrectionPrompt
};
