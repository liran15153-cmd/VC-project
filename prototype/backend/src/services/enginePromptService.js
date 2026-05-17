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
    'applyForce',
    'applyTorque',
    'setVelocity',
    'setLinearVelocity',
    'setVelocityX',
    'setVelocityY',
    'setVelocityZ',
    'setAngularVelocity',
    'addKnockback',
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
- Include exactly one directly playable initial gameplay scene for this stage. Do not make initialScene a menu, title screen, instructions screen, or empty hub.
- Prefer initialScene: "main" and make scene key "main" the gameplay scene.
- Include a player entity with key "player", tag "player", either mesh or model, a dynamic rigidBody, and cameraTarget.
- Include a static ground/platform with a collider.
- Include inputBindings for movement and at least one action:
  moveLeft -> ["ArrowLeft", "KeyA"]
  moveRight -> ["ArrowRight", "KeyD"]
  jump -> ["Space", "ArrowUp", "KeyW"]
- Include behaviors for movement in scene.behaviors or top-level behaviors only. Platformer-like games should use setVelocityX and applyImpulse.
- Do not put behaviors on entities. entities[].behaviors is not part of the runtime contract and will be ignored.
- Use only the supported behavior actions listed above. Do not invent actions like applyInputMove, flipSpriteOnInput, setText, incrementVar, setVar, modifyScore, or removeOther.
- Include a win or lose condition using state, collision, timer, or scene switching.
- Include UI text that reflects state, such as Score: {score}, Lives: {lives}, Time: {time}, or Goal: {goal}.
- Every state key used by UI text placeholders, stateChange triggers, behavior conditions, or state actions MUST be declared in the top-level state object with an initial value.
- Add "physicsSync" and "camera" to every playable scene's systems. Add behavior, spawner, tween, ui, or audio only when used.
- Any playable scene with the "camera" system MUST have one entity with cameraTarget. Prefer adding cameraTarget to the player entity.

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
- Collision gameplay should use structured triggers such as {"type":"collision","entityTag":"player","withTag":"collectible"} and actions such as incrementState or destroyEntity with target "collisionOther".
- Behavior actions setState/incrementState/decrementState, stateChange triggers, and state conditions must use declared state keys only. Do not reference undeclared keys.
- To remove a collided collectible/hazard, use target "collisionOther".
- switchScene actions must point to an existing scene key.
- Spawners must reference a prefab key that exists in prefabs.
- Entity keys must be unique within each scene.
- Use colors as "#RRGGBB" strings for readability.

STRICT SHAPE RULES (the validator rejects drift here):
- transform.position, transform.scale, mesh.size, and collider.halfExtents MUST be objects {x,y,z}. transform.rotation MUST be a quaternion object {x,y,z,w}. NEVER arrays.
- ui[].style.fontSize MUST be a CSS length string like "24px" — never a bare number.
- rigidBody.type MUST be exactly one of "dynamic", "static", "kinematic". For sensor/trigger volumes use {"type":"static","colliderOptions":{"sensor":true}}.
- Every rigidBody MUST include a "collider" object: {"shape":"cuboid"|"ball"|"capsule", ...}. Mesh shape is for rendering only; collider shape is for physics. Pair them: box mesh → cuboid collider, sphere mesh → ball collider, cylinder/capsule mesh → capsule collider.
- entities[].cameraTarget MUST be an object {"lerp":<n>,"offset":{x,y,z}} or omitted. NEVER a boolean.
- Every entities[].sprite MUST include "kind": "text" or "image". For images also include "assetKey" referencing an asset of type image/spritesheet/atlas.
- For compound triggers use the structured object form, e.g. {"type":"collision","entityTag":"player","withTag":"coin"}. Plain string triggers are only for single-token events ("sceneStart", "update").
- Runtime behavior lists are only top-level behaviors[] and scenes[].behaviors[]. Do NOT emit entities[].behaviors.
- scenes[].systems[] entries MUST come from this exact set: physicsSync, camera, behavior, tween, spawner, ui, audio. Do NOT add "input" or "render" — those are always wired by the engine.
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
  const assetContract = buildAssetContractForPrompt(assetCandidates);

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
      'EXPLICIT ASSET CONTRACT:',
      JSON.stringify(assetContract, null, 2),
      '',
      'ASSET USAGE RULES:',
      '- allowedAssetKeys is the exact allowlist. Every assetKey used in sprites, models, audio, prefabs, animations, UI, or behaviors must exist in allowedAssetKeys.',
      '- Do not invent keys such as ui_arrow unless they are explicitly listed in allowedAssetKeys.',
      '- You may use zero or more existing assets, but only from AVAILABLE EXISTING ASSETS.',
      '- If you use an asset, copy its id into assets[].key and entity.model.assetKey or sprite.assetKey.',
      '- Copy its publicPath exactly into assets[].url.',
      '- If a matching asset does not exist, use a supported primitive mesh, text UI, or silent/no-audio fallback instead of inventing an assetKey.',
      '- If an existing asset is not needed, do not include it in assets[] or any GameDefinition reference.',
      '- Try to use requiredAssetKeys when they fit the scene. optionalAssetKeys may be ignored without failing generation.',
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
    'GAMEPLAY CONTRACT RULES:',
    '- initialScene MUST point to the directly playable gameplay scene, not a menu/title/instructions scene. For this stage, avoid menu scenes unless explicitly requested.',
    '- Put behavior rules only in top-level behaviors[] or scenes[].behaviors[]. Never put behaviors on entities; entity-level behaviors are ignored by the runtime.',
    '- Use only supported behavior actions: setState, incrementState, decrementState, switchScene, spawnPrefab, destroyEntity, applyImpulse, applyForce, applyTorque, setVelocity, setLinearVelocity, setVelocityX, setVelocityY, setVelocityZ, setAngularVelocity, addKnockback, setPosition, translate, playSound, emitEvent, addTag, removeTag.',
    '- For movement, use inputDown/inputReleased/inputPressed triggers with setVelocityX and applyImpulse targeting "player". Do not invent actions such as applyInputMove or flipSpriteOnInput.',
    '- For collectibles/triggers, use colliderOptions: {"sensor":true}, tags such as "collectible", and collision behaviors using target "collisionOther" when destroying the collected entity.',
    '- Every state key used by UI text placeholders, stateChange triggers, behavior conditions, or state actions MUST be declared in the top-level state object with an initial value.',
    '- Any behavior trigger, condition, or action that references a state key must use a declared state key.',
    '- Any playable scene with the "camera" system MUST have one entity with cameraTarget. Prefer adding cameraTarget to the player entity.',
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
  const assetContract = buildAssetContractForPrompt(assetCandidates);
  const invalidAssetKey = extractInvalidAssetKey(validationReason);
  const invalidAsset = extractInvalidAssetDetails(validationReason) || { key: invalidAssetKey };
  const assetCorrectionLines = invalidAssetKey ? [
    '',
    'ASSET KEY FAILURE:',
    `- Invalid assetKey: "${invalidAssetKey}"`,
    `- Closest allowed keys: ${JSON.stringify(closestAllowedAssetKeys(invalidAsset, assetCandidates))}`,
    `- Allowed keys: ${JSON.stringify(assetContract.allowedAssetKeys)}`,
    '- Fix rule: replace the invalid key with one allowed key or remove the reference. Do not create a new asset. Do not invent new asset keys.'
  ] : [];
  const contractCorrectionLines = buildGenerationContractCorrectionLines(validationReason);

  return [
    buildEngineGenerationPrompt({ prompt: originalPrompt, brief, assetCandidates, assetManifest }),
    '',
    'HARD REQUIREMENTS (from prior failure — these caused the last attempt to be rejected):',
    '- Vectors are objects {x,y,z} — never arrays. Rotation is a quaternion {x,y,z,w}.',
    '- fontSize is a string ending in "px" or "rem" (e.g. "24px"), never a bare number.',
    '- rigidBody.type ∈ {dynamic, static, kinematic} and rigidBody.collider {shape, ...} is required.',
    '- For sensor/trigger volumes use {type:"static", colliderOptions:{sensor:true}} — do NOT invent new type values.',
    '- cameraTarget is an object {lerp, offset} or omitted — never a boolean.',
    '- sprite has "kind" ("text"|"image"); image sprites also need "assetKey".',
    '- Asset keys are closed-world: use only allowedAssetKeys from the EXPLICIT ASSET CONTRACT, or remove the asset reference and use primitives/text/silence.',
    '- initialScene must be a playable gameplay scene with player, ground/platform collider, and scene/top-level behavior rules. Do not use a dead menu as initialScene.',
    '- Behavior rules belong in scene.behaviors or top-level behaviors only. Do not put behaviors on entities.',
    '- Behavior actions must be supported runtime actions only. Replace unsupported actions instead of relying on normalization to drop them.',
    ...assetCorrectionLines,
    ...contractCorrectionLines,
    '- scenes[].systems[] ⊆ {physicsSync, camera, behavior, tween, spawner, ui, audio}.',
    '',
    `PREVIOUS ATTEMPT FAILED GAME_ENGINE VALIDATION: ${validationReason}`,
    'Fix the JSON so it validates and remains playable. Return JSON only.'
  ].join('\n');
}

function buildAssetContractForPrompt(assetCandidates = []) {
  const allowedAssetKeys = uniqueStrings(assetCandidates.map((asset) => asset.id));
  const requiredAssetKeys = uniqueStrings(assetCandidates
    .filter(isRequiredAssetCandidate)
    .map((asset) => asset.id));
  const requiredSet = new Set(requiredAssetKeys);
  const optionalAssetKeys = allowedAssetKeys.filter((key) => !requiredSet.has(key));
  return {
    allowedAssetKeys,
    requiredAssetKeys,
    optionalAssetKeys,
    rule: 'Every assetKey used in sprites, models, audio, prefabs, animations, UI, or behaviors must exist in allowedAssetKeys. Do not invent keys such as ui_arrow unless they are explicitly listed.'
  };
}

function isRequiredAssetCandidate(asset) {
  const role = String(asset.role || '').toLowerCase();
  const confidence = Number(asset.confidenceScore || 0);
  if (confidence < 0.65) return false;
  return ['player', 'main-character', 'character', 'environment', 'terrain', 'platform', 'world', 'enemy', 'main-enemy'].includes(role);
}

function extractInvalidAssetKey(reason) {
  const text = String(reason || '');
  const match = text.match(/Generated asset "([^"]+)" is not in the supplied asset candidates/i)
    || text.match(/Invalid assetKey:\s*"([^"]+)"/i)
    || text.match(/assetKey\s+"([^"]+)"/i);
  return match ? match[1] : null;
}

function extractInvalidAssetDetails(reason) {
  const text = String(reason || '');
  const match = text.match(/INVALID_ASSET_DETAILS=({.*?})(?:\s|$)/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (_err) {
    return null;
  }
}

function buildGenerationContractCorrectionLines(validationReason) {
  const text = String(validationReason || '');
  const lines = [];

  if (text.includes('BEHAVIOR_STATE_KEY_MISSING')) {
    lines.push(
      '',
      'STATE KEY FAILURE:',
      `- Missing state keys: ${extractJsonArrayFromReason(text, 'missingStateKeys')}`,
      `- Declared state keys: ${extractJsonArrayFromReason(text, 'declaredStateKeys')}`,
      `- Referenced state keys: ${extractJsonArrayFromReason(text, 'referencedStateKeys')}`,
      '- Fix rule: every behavior trigger, condition, and action that references state must use a top-level state key. Declare the missing key with an initial value or change the behavior to an existing state key. Do not leave undeclared state references.'
    );
  }

  if (text.includes('SCENE_HAS_CAMERA_NO_TARGET')) {
    lines.push(
      '',
      'CAMERA TARGET FAILURE:',
      `- Scenes missing camera target: ${extractJsonArrayFromReason(text, 'scenesMissingCameraTarget')}`,
      '- Fix rule: every scene with "camera" in systems needs one entity with cameraTarget. Prefer the player entity when available, e.g. cameraTarget: {"lerp":5,"offset":{"x":0,"y":4,"z":8}}.'
    );
  }

  if (text.includes('BEHAVIOR_ACTION_UNSUPPORTED')) {
    lines.push(
      '',
      'UNSUPPORTED BEHAVIOR ACTION FAILURE:',
      '- Fix rule: use only supported runtime actions. Replace or remove unsupported actions instead of creating aliases.',
      '- Supported movement actions: setVelocityX, setVelocityY, setVelocityZ, setVelocity, setLinearVelocity, applyImpulse, applyForce.',
      '- Supported game-rule actions: incrementState, decrementState, setState, destroyEntity, switchScene, spawnPrefab, playSound, emitEvent.',
      '- Do not use applyInputMove, flipSpriteOnInput, setText, incrementVar, setVar, modifyScore, removeOther, or custom action names.'
    );
  }

  if (text.includes('PLAYABILITY_CONTRACT_FAILED') || text.includes('INITIAL_SCENE_NOT_PLAYABLE') || text.includes('PLAYABLE_SCENE_NO_')) {
    lines.push(
      '',
      'PLAYABILITY FAILURE:',
      '- Fix rule: initialScene must point to the directly playable gameplay scene, preferably "main".',
      '- Do not make the initial scene a menu/title/instructions scene.',
      '- The initial scene needs a dynamic player entity, a static ground/platform/world collider, and supported scene.behaviors or top-level behaviors.',
      '- Do not put behaviors on entities; entity-level behaviors are ignored by the runtime.'
    );
  }

  return lines;
}

function extractJsonArrayFromReason(text, fieldName) {
  const match = String(text || '').match(new RegExp(`${fieldName}=(\\[[\\s\\S]*?\\])(?:;|\\.|\\s[A-Z_]+:|$)`));
  if (!match) return '[]';
  return match[1];
}

function closestAllowedAssetKeys(invalidAssetOrKey, assetCandidatesOrKeys = [], limit = 5) {
  const invalid = typeof invalidAssetOrKey === 'object' && invalidAssetOrKey
    ? invalidAssetOrKey
    : { key: invalidAssetOrKey };
  const candidates = assetCandidatesOrKeys.map((item) => (typeof item === 'string' ? { id: item } : item)).filter(Boolean);
  const filtered = filterClosestAssetCandidates(candidates, invalid);
  const normalizedInvalid = normalizeForDistance(invalid.key || invalid.name || invalid.url);
  return filtered
    .map((asset) => ({
      key: asset.id,
      distance: levenshtein(normalizedInvalid, normalizeForDistance([asset.id, asset.name, asset.publicPath].filter(Boolean).join(' ')))
    }))
    .sort((a, b) => a.distance - b.distance || a.key.localeCompare(b.key))
    .slice(0, limit)
    .map((entry) => entry.key);
}

function filterClosestAssetCandidates(candidates, invalid) {
  let filtered = candidates;
  const desiredType = normalizeAssetType(invalid.type);
  if (desiredType) {
    const byType = filtered.filter((asset) => normalizeAssetType(asset.type) === desiredType);
    if (byType.length) filtered = byType;
  }

  const desiredRole = normalize(invalid.role) || inferRoleFromKey(invalid.key || invalid.name || invalid.url);
  if (desiredRole) {
    const byRole = filtered.filter((asset) => {
      const role = normalize(asset.role);
      const hints = (asset.roleHints || []).map(normalize);
      return role === desiredRole || hints.includes(desiredRole);
    });
    if (byRole.length) filtered = byRole;
  }

  const desiredDimension = normalizeDimension(invalid.dimension);
  if (desiredDimension) {
    const byDimension = filtered.filter((asset) => dimensionsCompatible(normalizeDimension(asset.dimension || asset.assetDimension), desiredDimension));
    if (byDimension.length) filtered = byDimension;
  }

  return filtered.length ? filtered : candidates;
}

function normalizeAssetType(value) {
  const type = normalize(value);
  if (!type) return '';
  if (type === 'glb' || type === 'gltf' || type === 'model') return 'gltf';
  if (type === 'png' || type === 'jpg' || type === 'jpeg' || type === 'webp' || type === 'image') return 'image';
  return type;
}

function normalizeDimension(value) {
  const dimension = normalize(value);
  if (dimension === '2d') return '2D';
  if (dimension === '3d') return '3D';
  if (dimension === 'hybrid') return 'hybrid';
  if (dimension === 'any') return 'any';
  return '';
}

function dimensionsCompatible(assetDimension, desiredDimension) {
  if (!assetDimension || assetDimension === 'any' || desiredDimension === 'any') return true;
  if (desiredDimension === 'hybrid') return ['hybrid', '3D', 'any'].includes(assetDimension);
  return assetDimension === desiredDimension || assetDimension === 'hybrid';
}

function inferRoleFromKey(value) {
  const text = normalize(value);
  if (text.includes('ui') || text.includes('hud') || text.includes('button') || text.includes('arrow')) return 'ui';
  if (text.includes('player') || text.includes('hero') || text.includes('character')) return 'player';
  if (text.includes('enemy') || text.includes('monster')) return 'enemy';
  if (text.includes('coin') || text.includes('gem') || text.includes('collect')) return 'collectible';
  if (text.includes('ground') || text.includes('platform') || text.includes('terrain')) return 'platform';
  if (text.includes('sound') || text.includes('audio') || text.includes('music')) return 'audio';
  return '';
}

function levenshtein(a, b) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = new Array(b.length + 1);
  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }
  return previous[b.length];
}

function normalizeForDistance(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function normalize(value) {
  return String(value || '').toLowerCase().trim();
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()))];
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
    role: asset.role,
    dimension: asset.dimension || asset.assetDimension,
    confidenceScore: asset.confidenceScore,
    tags: (asset.tags || []).slice(0, 10),
    engineCompatibility: asset.engineCompatibility || []
  };
}

module.exports = {
  ENGINE_CAPABILITIES,
  ENGINE_GAME_SYSTEM_PROMPT,
  buildEngineGenerationPrompt,
  buildEngineCorrectionPrompt,
  buildAssetContractForPrompt,
  extractInvalidAssetKey,
  extractInvalidAssetDetails,
  closestAllowedAssetKeys
};
