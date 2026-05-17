const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'fatal';

const {
  buildEngineGenerationPrompt,
  buildEngineCorrectionPrompt
} = require('../src/services/enginePromptService');
const {
  validateGeneratedAssetUse,
  validateGeneratedGameDefinition,
  buildAssetUsageSummary
} = require('../src/services/engineGenerationService');

const ASSET_CANDIDATES = [
  {
    id: 'robot_player_glb',
    name: 'Robot Player',
    type: 'gltf',
    format: 'glb',
    publicPath: '/assets/library/robots/player.glb',
    role: 'player',
    confidenceScore: 0.91
  },
  {
    id: 'stone_enemy_glb',
    name: 'Stone Enemy',
    type: 'gltf',
    format: 'glb',
    publicPath: '/assets/library/enemies/stone.glb',
    role: 'enemy',
    confidenceScore: 0.82
  },
  {
    id: 'hud_panel_png',
    name: 'HUD Panel',
    type: 'image',
    format: 'png',
    publicPath: '/assets/library/ui/hud-panel.png',
    role: 'ui',
    confidenceScore: 0.54
  }
];

function minimalDefinition({ assets = [], playerAssetKey = 'robot_player_glb' } = {}) {
  return {
    schemaVersion: 1,
    metadata: {
      title: 'Asset Contract Fixture',
      description: 'Fixture for asset contract tests.',
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
    state: { score: { type: 'number', initial: 0 } },
    inputBindings: {
      moveLeft: ['ArrowLeft', 'KeyA'],
      moveRight: ['ArrowRight', 'KeyD'],
      jump: ['Space']
    },
    assets,
    prefabs: {},
    behaviors: [],
    animations: [],
    ui: [{ type: 'text', text: 'Score: {score}', x: 16, y: 16 }],
    audio: [],
    scenes: [
      {
        key: 'main',
        systems: ['physicsSync', 'camera', 'ui'],
        entities: [
          {
            key: 'player',
            tags: ['player'],
            transform: { position: { x: 0, y: 1, z: 0 } },
            model: { assetKey: playerAssetKey },
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
    initialScene: 'main'
  };
}

function assetEntry(key, type, url) {
  return { key, type, url };
}

test('asset contract: engine prompt includes allowedAssetKeys and no-invented-assets rule', () => {
  const prompt = buildEngineGenerationPrompt({
    prompt: 'Small puzzle game',
    assetCandidates: ASSET_CANDIDATES
  });

  assert.match(prompt, /EXPLICIT ASSET CONTRACT/);
  assert.match(prompt, /allowedAssetKeys/);
  assert.match(prompt, /robot_player_glb/);
  assert.match(prompt, /stone_enemy_glb/);
  assert.match(prompt, /requiredAssetKeys/);
  assert.match(prompt, /optionalAssetKeys/);
  assert.match(prompt, /Do not invent keys such as ui_arrow/);
  assert.match(prompt, /must exist in allowedAssetKeys/);
});

test('asset contract: validateGeneratedAssetUse rejects invented ui_arrow asset key', () => {
  const definition = minimalDefinition({
    assets: [
      assetEntry('robot_player_glb', 'gltf', '/assets/library/robots/player.glb'),
      assetEntry('ui_arrow', 'image', '/assets/library/ui/ui-arrow.png')
    ]
  });

  const result = validateGeneratedAssetUse(definition, ASSET_CANDIDATES);

  assert.equal(result.ok, false);
  assert.match(result.reason, /ui_arrow/);
  assert.deepEqual(result.assetUsageSummary.invalidAssetKeys, ['ui_arrow']);
});

test('asset contract: correction prompt names invalid key, allowed keys, and no-invent rule', () => {
  const prompt = buildEngineCorrectionPrompt({
    originalPrompt: 'Small puzzle game',
    validationReason: 'Generated asset "ui_arrow" is not in the supplied asset candidates.',
    assetCandidates: ASSET_CANDIDATES
  });

  assert.match(prompt, /Invalid assetKey: "ui_arrow"/);
  assert.match(prompt, /Allowed keys:/);
  assert.match(prompt, /robot_player_glb/);
  assert.match(prompt, /stone_enemy_glb/);
  assert.match(prompt, /Do not create a new asset/);
  assert.match(prompt, /Do not invent new asset keys/);
});

test('asset contract: GameDefinition using only allowed asset keys passes', () => {
  const definition = minimalDefinition({
    assets: [assetEntry('robot_player_glb', 'gltf', '/assets/library/robots/player.glb')]
  });

  const result = validateGeneratedGameDefinition(definition, ASSET_CANDIDATES);

  assert.equal(result.ok, true, result.reason);
  assert.deepEqual(result.assetUsageSummary.invalidAssetKeys, []);
  assert.deepEqual(result.assetUsageSummary.usedAssetKeys, ['robot_player_glb']);
});

test('asset contract: UNUSED_ASSET remains warning-only and does not fail generation', () => {
  const definition = minimalDefinition({
    assets: [
      assetEntry('robot_player_glb', 'gltf', '/assets/library/robots/player.glb'),
      assetEntry('stone_enemy_glb', 'gltf', '/assets/library/enemies/stone.glb')
    ]
  });

  const result = validateGeneratedGameDefinition(definition, ASSET_CANDIDATES);

  assert.equal(result.ok, true, result.reason);
  assert.ok(result.debugReport.diagnostics.some((diag) => diag.code === 'UNUSED_ASSET'));
  assert.deepEqual(result.assetUsageSummary.unusedAssetKeys, ['hud_panel_png', 'stone_enemy_glb']);
});

test('asset contract: assetUsageSummary reports used, unused, and invalid keys', () => {
  const definition = minimalDefinition({
    assets: [
      assetEntry('robot_player_glb', 'gltf', '/assets/library/robots/player.glb'),
      assetEntry('ui_arrow', 'image', '/assets/library/ui/ui-arrow.png')
    ]
  });

  const summary = buildAssetUsageSummary(definition, ASSET_CANDIDATES);

  assert.equal(summary.allowedAssetCount, 3);
  assert.equal(summary.usedAssetCount, 1);
  assert.equal(summary.unusedAssetCount, 2);
  assert.deepEqual(summary.usedAssetKeys, ['robot_player_glb']);
  assert.deepEqual(summary.unusedAssetKeys, ['hud_panel_png', 'stone_enemy_glb']);
  assert.deepEqual(summary.invalidAssetKeys, ['ui_arrow']);
});
