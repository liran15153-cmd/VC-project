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
  modelComponent: {
    assetKey: 'must match a top-level gltf asset key',
    positionOffset: 'local Vec3 offset',
    rotationOffset: 'local Euler Vec3 in radians',
    scale: 'local Vec3 scale',
    castShadow: 'boolean',
    receiveShadow: 'boolean'
  },
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
- Keep games browser-playable with primitive meshes when no useful existing asset is supplied.
- When existing assets are supplied, use only those asset IDs/URLs and never invent asset paths.
- If the user's game idea asks for a feature not supported yet, approximate it with supported primitives and explain the limitation in metadata.description.
- Hybrid v1 means mixed runtime composition, not Phaser Arcade gameplay simulation: Three.js world/model visuals, Phaser sprites/UI/overlays, and Rapier physics in one GameDefinition.

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
- Include a player entity with key "player", tag "player", either mesh or model, a dynamic rigidBody, and cameraTarget.
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
- Every assetKey reference must resolve to a top-level assets[] entry. Do not reference undeclared assets.
- GLB/GLTF assets must be declared in top-level assets with type "gltf", then placed with entity.model.assetKey.
- Sprite image references must use top-level asset type "image", "spritesheet", or "atlas", then placed with sprite.assetKey.
- Audio references must use top-level asset type "audio", then placed in audio rules or playSound actions.
- Model visuals are separate from physics. Use primitive rigidBody colliders for collisions.
- Do not put both mesh and model on the same entity unless the mesh is intentionally unused fallback; prefer model + rigidBody for asset visuals.
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

function buildEngineGenerationPrompt({ prompt, brief = null, assetCandidates = [], assetManifest = null }) {
  const palette = pick(PALETTE_OPTIONS);
  const hint = pick(GENRE_HINTS);
  const seed = Math.floor(Math.random() * 9000) + 1000;
  const compactAssets = assetCandidates.map(compactAssetForPrompt);

  const parts = [
    `USER GAME IDEA: ${prompt}`,
    '',
  ];

  if (brief) {
    parts.push('ACCEPTED GAME BRIEF JSON:', JSON.stringify(brief, null, 2), '');
  }

  if (compactAssets.length > 0) {
    parts.push(
      'AVAILABLE EXISTING ASSETS:',
      JSON.stringify(compactAssets, null, 2),
      '',
      'ASSET USAGE RULES:',
      '- You may use zero or more existing assets, but only from AVAILABLE EXISTING ASSETS.',
      '- If you use an asset, copy its id into assets[].key and entity.model.assetKey or sprite.assetKey.',
      '- Copy its publicPath exactly into assets[].url.',
      '- For GLB/GLTF assets, assets[].type must be "gltf".',
      '- For UI/HUD/overlay sprites, assets[].type must be "image", "spritesheet", or "atlas".',
      '- For sound effects or music, assets[].type must be "audio".',
      '- Prefer GLB/GLTF for 3D characters, props, coins, platforms, hazards, and decorations.',
      '- For hybrid briefs, use GLB/GLTF assets for Three.js world/model visuals and image/spritesheet/atlas assets only for Phaser UI/HUD/overlays.',
      '- Do not generate Phaser Arcade gameplay as part of hybrid v1.',
      '- Do not use FBX, OBJ, MTL, or any asset not listed above.',
      ''
    );
  }

  if (assetManifest) {
    parts.push('RUNTIME ASSET MANIFEST CANDIDATES:', JSON.stringify(assetManifest, null, 2), '');
  }

  parts.push(
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
  );

  return parts.join('\n');
}

function buildEngineCorrectionPrompt({ originalPrompt, validationReason, brief = null, assetCandidates = [], assetManifest = null }) {
  return [
    buildEngineGenerationPrompt({ prompt: originalPrompt, brief, assetCandidates, assetManifest }),
    '',
    `PREVIOUS ATTEMPT FAILED GAME_ENGINE VALIDATION: ${validationReason}`,
    'Fix the JSON so it validates and remains playable. Return JSON only.'
  ].join('\n');
}

function compactAssetForPrompt(asset) {
  return {
    id: asset.id,
    name: asset.name,
    type: asset.type,
    format: asset.format,
    publicPath: asset.publicPath,
    category: asset.category,
    subcategory: asset.subcategory,
    tags: (asset.tags || []).slice(0, 10),
    engineCompatibility: asset.engineCompatibility || []
  };
}

module.exports = {
  ENGINE_CAPABILITIES,
  ENGINE_GAME_SYSTEM_PROMPT,
  buildEngineGenerationPrompt,
  buildEngineCorrectionPrompt
};
