const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'fatal';

const {
  buildEngineGenerationPrompt,
  buildEngineCorrectionPrompt,
  closestAllowedAssetKeys
} = require('../src/services/enginePromptService');
const {
  validateGeneratedGameDefinition,
  buildAssetUsageSummary,
  buildBehaviorStateUsageSummary,
  buildCameraUsageSummary
} = require('../src/services/engineGenerationService');

const ASSET_CANDIDATES = [
  {
    id: 'player_glb',
    name: 'Player Model',
    type: 'gltf',
    format: 'glb',
    role: 'player',
    dimension: '3D',
    confidenceScore: 0.92,
    publicPath: '/assets/library/player.glb'
  },
  {
    id: 'enemy_glb',
    name: 'Enemy Model',
    type: 'gltf',
    format: 'glb',
    role: 'enemy',
    dimension: '3D',
    confidenceScore: 0.81,
    publicPath: '/assets/library/enemy.glb'
  },
  {
    id: 'hud_panel_png',
    name: 'HUD Panel',
    type: 'image',
    format: 'png',
    role: 'ui',
    dimension: '2D',
    confidenceScore: 0.7,
    publicPath: '/assets/library/hud-panel.png'
  }
];

function baseDefinition(overrides = {}) {
  return {
    schemaVersion: 1,
    metadata: {
      title: 'Generation Contract Fixture',
      description: 'Fixture for Stage 2D hardening.',
      genre: 'platformer'
    },
    engine: {
      width: 960,
      height: 540,
      enable3D: true,
      enable2D: true,
      enablePhysics: true,
      gravity: { x: 0, y: -12, z: 0 },
      background: '#111827'
    },
    state: {
      score: { type: 'number', initial: 0 }
    },
    inputBindings: {
      moveLeft: ['ArrowLeft', 'KeyA'],
      moveRight: ['ArrowRight', 'KeyD'],
      jump: ['Space']
    },
    assets: [
      { key: 'player_glb', type: 'gltf', url: '/assets/library/player.glb' }
    ],
    prefabs: {},
    behaviors: [],
    animations: [],
    ui: [{ type: 'text', text: 'Score: {score}', x: 16, y: 16 }],
    audio: [],
    scenes: [
      {
        key: 'main',
        systems: ['physicsSync', 'camera', 'behavior', 'ui'],
        entities: [
          {
            key: 'player',
            tags: ['player'],
            transform: { position: { x: 0, y: 1, z: 0 } },
            model: { assetKey: 'player_glb' },
            rigidBody: {
              type: 'dynamic',
              collider: { shape: 'cuboid', halfExtents: { x: 0.4, y: 0.6, z: 0.4 } }
            },
            cameraTarget: { lerp: 5, offset: { x: 0, y: 4, z: 8 } }
          },
          {
            key: 'ground',
            tags: ['ground'],
            transform: { position: { x: 0, y: -0.25, z: 0 } },
            mesh: { shape: 'box', size: { x: 12, y: 0.5, z: 4 }, color: '#4a7c59' },
            rigidBody: {
              type: 'static',
              collider: { shape: 'cuboid', halfExtents: { x: 6, y: 0.25, z: 2 } }
            }
          }
        ]
      }
    ],
    initialScene: 'main',
    ...overrides
  };
}

test('stage2d: generation prompt states the state-key and camera-target contracts', () => {
  const prompt = buildEngineGenerationPrompt({
    prompt: 'A 3D platformer',
    assetCandidates: ASSET_CANDIDATES
  });

  assert.match(prompt, /Every state key used/);
  assert.match(prompt, /MUST be declared in the top-level state object/);
  assert.match(prompt, /Any playable scene with the "camera" system MUST have one entity with cameraTarget/);
  assert.match(prompt, /Never put behaviors on entities/);
  assert.match(prompt, /initialScene MUST point to the directly playable gameplay scene/);
  assert.match(prompt, /Do not invent actions such as applyInputMove/);
});

test('stage2d: initial menu scene fails the playability contract', () => {
  const playableScene = baseDefinition().scenes[0];
  const definition = baseDefinition({
    initialScene: 'mainMenu',
    scenes: [
      {
        key: 'mainMenu',
        systems: ['ui'],
        entities: [
          {
            key: 'title',
            sprite: { kind: 'text', text: 'Press Start', x: 120, y: 120 }
          }
        ]
      },
      playableScene
    ]
  });

  const result = validateGeneratedGameDefinition(definition, ASSET_CANDIDATES);

  assert.equal(result.ok, true, result.reason);
  assert.match(result.generationContractReason, /PLAYABILITY_CONTRACT_FAILED/);
  assert.ok(result.generationContractIssues.includes('INITIAL_SCENE_NOT_PLAYABLE'));
});

test('stage2d: unsupported behavior action fails generation contract and correction prompt names the rule', () => {
  const definition = baseDefinition();
  definition.scenes[0].behaviors = [
    {
      trigger: { type: 'inputDown', input: 'moveRight' },
      actions: [{ type: 'applyInputMove', target: 'player', value: { x: 1, y: 0, z: 0 } }]
    }
  ];

  const result = validateGeneratedGameDefinition(definition, ASSET_CANDIDATES);

  assert.equal(result.ok, true, result.reason);
  assert.match(result.generationContractReason, /BEHAVIOR_ACTION_UNSUPPORTED/);
  assert.ok(result.generationContractIssues.includes('BEHAVIOR_ACTION_UNSUPPORTED'));

  const correction = buildEngineCorrectionPrompt({
    originalPrompt: 'A 3D platformer',
    validationReason: result.generationContractReason,
    assetCandidates: ASSET_CANDIDATES
  });
  assert.match(correction, /UNSUPPORTED BEHAVIOR ACTION FAILURE/);
  assert.match(correction, /Do not use applyInputMove/);
});

test('stage2d: playable scene with supported scene behaviors passes generation contract', () => {
  const definition = baseDefinition();
  definition.scenes[0].behaviors = [
    {
      trigger: { type: 'inputDown', input: 'moveRight' },
      actions: [{ type: 'setVelocityX', target: 'player', value: 5 }]
    },
    {
      trigger: { type: 'inputPressed', input: 'jump' },
      actions: [{ type: 'applyImpulse', target: 'player', value: { x: 0, y: 7, z: 0 } }]
    }
  ];

  const result = validateGeneratedGameDefinition(definition, ASSET_CANDIDATES);

  assert.equal(result.ok, true, result.reason);
  assert.equal(result.generationContractReason, null);
});

test('stage2d: missing behavior state key fails generation contract and correction prompt names exact key', () => {
  const definition = baseDefinition({
    behaviors: [
      { trigger: 'sceneStart', actions: [{ type: 'incrementState', stateKey: 'combo', amount: 1 }] }
    ]
  });

  const summary = buildBehaviorStateUsageSummary(definition);
  assert.deepEqual(summary.declaredStateKeys, ['score']);
  assert.deepEqual(summary.referencedStateKeys, ['combo']);
  assert.deepEqual(summary.missingStateKeys, ['combo']);

  const result = validateGeneratedGameDefinition(definition, ASSET_CANDIDATES);
  assert.equal(result.ok, true, result.reason);
  assert.match(result.generationContractReason, /BEHAVIOR_STATE_KEY_MISSING/);
  assert.match(result.generationContractReason, /missingStateKeys=\["combo"\]/);

  const correction = buildEngineCorrectionPrompt({
    originalPrompt: 'A 3D platformer',
    validationReason: result.generationContractReason,
    assetCandidates: ASSET_CANDIDATES
  });
  assert.match(correction, /STATE KEY FAILURE/);
  assert.match(correction, /Missing state keys: \["combo"\]/);
  assert.match(correction, /Declare the missing key with an initial value/);
});

test('stage2d: scene camera system without target fails generation contract and correction prompt prefers player', () => {
  const definition = baseDefinition();
  delete definition.scenes[0].entities[0].cameraTarget;

  const summary = buildCameraUsageSummary(definition);
  assert.deepEqual(summary.scenesWithCameraSystem, ['main']);
  assert.deepEqual(summary.scenesMissingCameraTarget, [{ sceneKey: 'main', sceneIndex: 0, preferredTargetKey: 'player' }]);

  const result = validateGeneratedGameDefinition(definition, ASSET_CANDIDATES);
  assert.equal(result.ok, true, result.reason);
  assert.match(result.generationContractReason, /SCENE_HAS_CAMERA_NO_TARGET/);
  assert.match(result.generationContractReason, /preferredTargetKey":"player"/);

  const correction = buildEngineCorrectionPrompt({
    originalPrompt: 'A 3D platformer',
    validationReason: result.generationContractReason,
    assetCandidates: ASSET_CANDIDATES
  });
  assert.match(correction, /CAMERA TARGET FAILURE/);
  assert.match(correction, /Prefer the player entity/);
});

test('stage2d: assetUsageSummary reports required asset usage without making unused assets fatal', () => {
  const definition = baseDefinition({
    assets: [
      { key: 'player_glb', type: 'gltf', url: '/assets/library/player.glb' },
      { key: 'enemy_glb', type: 'gltf', url: '/assets/library/enemy.glb' }
    ]
  });
  const result = validateGeneratedGameDefinition(definition, ASSET_CANDIDATES);

  assert.equal(result.ok, true, result.reason);
  assert.equal(result.assetUsageSummary.requiredAssetUsedCount, 1);
  assert.deepEqual(result.assetUsageSummary.unusedRequiredAssetKeys, ['enemy_glb']);
  assert.ok(result.debugReport.diagnostics.some((diag) => diag.code === 'UNUSED_ASSET'));
});

test('stage2d: closest allowed asset keys filter by type, role, and dimension before string distance', () => {
  const closest = closestAllowedAssetKeys(
    { key: 'ui_arrow', type: 'image', role: 'ui', dimension: '2D' },
    [
      ...ASSET_CANDIDATES,
      {
        id: 'arrow_enemy_glb',
        name: 'Arrow Enemy',
        type: 'gltf',
        role: 'enemy',
        dimension: '3D',
        confidenceScore: 0.95,
        publicPath: '/assets/library/arrow-enemy.glb'
      }
    ]
  );

  assert.deepEqual(closest, ['hud_panel_png']);
});

test('stage2d: wrong-type asset usage remains rejected by GameDefinition validation', () => {
  const definition = baseDefinition({
    assets: [{ key: 'hud_panel_png', type: 'image', url: '/assets/library/hud-panel.png' }]
  });
  definition.scenes[0].entities[0].model.assetKey = 'hud_panel_png';

  const result = validateGeneratedGameDefinition(definition, ASSET_CANDIDATES);

  assert.equal(result.ok, false);
  assert.match(result.reason, /expected gltf/i);
});

test('stage2d: standalone assetUsageSummary reports required counts', () => {
  const summary = buildAssetUsageSummary(baseDefinition(), ASSET_CANDIDATES);

  assert.equal(summary.allowedAssetCount, 3);
  assert.equal(summary.requiredAssetUsedCount, 1);
  assert.deepEqual(summary.unusedRequiredAssetKeys, ['enemy_glb']);
});
