#!/usr/bin/env node

const assert = require('node:assert/strict');
const { resolveAssetsForBrief } = require('../prototype/backend/src/services/assetResolutionService');

const followUpQuestions = [
  { id: 'pace', question: 'What pace?', options: [{ id: 'A', label: 'Relaxed', value: 'relaxed' }, { id: 'B', label: 'Fast', value: 'fast' }] },
  { id: 'danger', question: 'How dangerous?', options: [{ id: 'A', label: 'Low', value: 'low' }, { id: 'B', label: 'High', value: 'high' }] },
  { id: 'goal', question: 'Main goal?', options: [{ id: 'A', label: 'Collect', value: 'collect' }, { id: 'B', label: 'Escape', value: 'escape' }] }
];

function baseBrief(overrides = {}) {
  return {
    title: 'Asset Eval',
    oneSentencePitch: 'A small playable test for asset resolution.',
    playerFantasy: 'Feel responsive and clear.',
    targetPlatform: 'desktop-first',
    dimension: '2D',
    genre: 'platformer',
    coreLoop: ['move', 'collect', 'avoid danger'],
    keyMechanics: ['movement', 'collectibles', 'hazards'],
    controls: { primary: 'WASD', mobile: 'touch controls', accessibilityNotes: [] },
    runtimePlan: {
      runtime: 'hybrid',
      phaserRole: '2D sprites, tilemaps, input, and UI.',
      threeRole: '3D models only when requested.',
      rapierRole: 'Collision and trigger volumes.',
      godotStyleGenerationNotes: 'Keep generated content editable.',
      systems: ['movement', 'ui']
    },
    assetPlan: {
      existingAssetsToUse: [],
      assetsToGenerate: ['player asset', 'environment asset'],
      visualStyle: 'clean readable arcade style'
    },
    missingInfo: [],
    followUpQuestions,
    productionNotes: ['Keep the first loop small.', 'Use registry assets only.'],
    nonGoals: ['No multiplayer'],
    ...overrides
  };
}

const cases = [
  {
    name: '2D platformer',
    body: {
      prompt: '2D platformer using Kenney new platformer pack with coins spikes enemy HUD coin sfx',
      dimension: '2D',
      brief: baseBrief({
        keyMechanics: ['jumping', 'coin collection', 'spike hazards', 'enemy avoidance', 'score HUD', 'coin sfx'],
        assetPlan: {
          existingAssetsToUse: ['Kenney new platformer pack'],
          assetsToGenerate: ['player sprite', 'coin collectible', 'spike hazard', 'enemy sprite', 'HUD coin icon', 'coin sfx'],
          visualStyle: 'bright platformer'
        }
      })
    },
    check: (out) => {
      assert.equal(out.meta.intent, 'full-game');
      assert.ok(out.selectedAssets.some((asset) => asset.role === 'player' && asset.pack.includes('new-platformer')));
      assert.ok(out.selectedAssets.some((asset) => asset.role === 'audio' && asset.type === 'audio'));
    }
  },
  {
    name: 'desert shooter',
    body: {
      prompt: '2D desert shooter using Kenney desert shooter pack with player enemies weapons interface tiles sounds',
      dimension: '2D',
      brief: baseBrief({
        genre: 'shooter',
        keyMechanics: ['shooting', 'enemy combat', 'projectiles', 'health HUD', 'weapon sound'],
        assetPlan: {
          existingAssetsToUse: ['Kenney desert shooter pack'],
          assetsToGenerate: ['player shooter sprite', 'enemy shooter sprite', 'weapon projectile sprite', 'desert terrain tiles', 'health interface', 'weapon sound'],
          visualStyle: 'desert shooter'
        }
      })
    },
    check: (out) => {
      assert.ok(out.selectedAssets.some((asset) => asset.role === 'player' && asset.pack.includes('desert-shooter')));
      assert.ok(out.selectedAssets.some((asset) => asset.role === 'enemy' && asset.pack.includes('desert-shooter')));
      assert.ok(out.selectedAssets.some((asset) => asset.role === 'ui' && asset.pack.includes('desert-shooter')));
    }
  },
  {
    name: 'mobile controls only',
    body: {
      prompt: 'Add mobile controls only: joystick, dpad and jump button UI',
      dimension: '2D',
      brief: baseBrief({
        title: 'Controls',
        keyMechanics: ['touch controls', 'joystick', 'dpad', 'button UI'],
        assetPlan: {
          existingAssetsToUse: ['mobile controls pack'],
          assetsToGenerate: ['mobile joystick UI', 'mobile dpad UI', 'touch button UI'],
          visualStyle: 'clean mobile controls'
        }
      })
    },
    check: (out) => {
      assert.deepEqual([...new Set(out.requirements.map((requirement) => requirement.role))], ['ui']);
      assert.ok(out.selectedAssets.every((asset) => asset.role === 'ui'));
      assert.ok(out.selectedAssets.some((asset) => asset.pack.includes('mobile-controls')));
    }
  },
  {
    name: 'roguelike tilemap',
    body: {
      prompt: 'Tilemap only for roguelike RPG dungeon using Kenney roguelike RPG pack',
      dimension: '2D',
      brief: baseBrief({
        title: 'Roguelike',
        genre: 'rpg',
        keyMechanics: ['tilemap movement', 'dungeon exploration', 'RPG tileset'],
        assetPlan: {
          existingAssetsToUse: ['Kenney roguelike RPG pack'],
          assetsToGenerate: ['roguelike tilemap', 'dungeon tileset'],
          visualStyle: 'roguelike rpg dungeon tilemap'
        }
      })
    },
    check: (out) => {
      assert.ok(out.selectedAssets.some((asset) => asset.type === 'tilemap' && asset.pack.includes('roguelike')));
      assert.ok(out.selectedAssets.some((asset) => asset.type === 'spritesheet' && asset.pack.includes('roguelike')));
    }
  },
  {
    name: '3D game',
    body: {
      prompt: '3D platformer using existing GLB assets',
      dimension: '3D',
      brief: baseBrief({
        dimension: '3D',
        genre: 'platformer-3d',
        keyMechanics: ['3D movement', 'jumping', 'collectibles', 'hazards'],
        assetPlan: {
          existingAssetsToUse: ['existing GLB assets'],
          assetsToGenerate: ['player 3D model', 'platform 3D model', 'coin 3D model'],
          visualStyle: 'low poly platformer'
        }
      })
    },
    check: (out) => {
      assert.ok(out.selectedAssets.some((asset) => asset.role === 'player' && asset.type === 'gltf'));
      assert.ok(out.selectedAssets.filter((asset) => asset.role !== 'ui').every((asset) => asset.type === 'gltf'));
    }
  },
  {
    name: 'hybrid game',
    body: {
      prompt: 'Hybrid 3D garden repair game using existing GLB models',
      dimension: 'hybrid',
      brief: baseBrief({
        dimension: 'hybrid',
        genre: 'adventure-tp',
        keyMechanics: ['3D movement', 'collectibles', 'hazards', 'repair objectives', 'HUD'],
        assetPlan: {
          existingAssetsToUse: ['existing 3D GLB assets'],
          assetsToGenerate: ['player 3D model', 'environment 3D props', 'collectible crystal', 'hazard model', 'HUD icon'],
          visualStyle: 'clean low poly garden'
        }
      })
    },
    check: (out) => {
      assert.ok(out.selectedAssets.some((asset) => asset.type === 'gltf'));
      assert.ok(out.meta.evaluatedAssets < out.meta.totalAssets);
    }
  },
  {
    name: 'UI only',
    body: {
      prompt: 'UI only: find HUD buttons and menu interface',
      dimension: '2D',
      brief: baseBrief({
        title: 'UI Only',
        keyMechanics: ['HUD', 'menu', 'buttons'],
        assetPlan: {
          existingAssetsToUse: ['mobile controls pack'],
          assetsToGenerate: ['HUD button UI', 'menu interface UI'],
          visualStyle: 'clean UI'
        }
      })
    },
    check: (out) => {
      assert.ok(out.requirements.every((requirement) => requirement.role === 'ui'));
    }
  },
  {
    name: 'audio only',
    body: {
      prompt: 'Audio only: find coin sfx and jump sounds from Kenney new platformer pack',
      dimension: '2D',
      brief: baseBrief({
        title: 'Audio',
        keyMechanics: ['audio', 'sfx', 'sound'],
        assetPlan: {
          existingAssetsToUse: ['Kenney new platformer pack'],
          assetsToGenerate: ['coin sfx', 'jump sound'],
          visualStyle: 'arcade audio'
        }
      })
    },
    check: (out) => {
      assert.ok(out.requirements.every((requirement) => requirement.role === 'audio'));
      assert.ok(out.selectedAssets.every((asset) => asset.type === 'audio'));
    }
  },
  {
    name: 'strict missing',
    body: {
      prompt: 'Audio only: find a music loop',
      dimension: '2D',
      selectedAssetIds: ['kenney-new-platformer-pack-1-1-sprites-tiles-default-hud-coin-png'],
      strictMissing: true,
      brief: baseBrief({
        title: 'Missing Audio',
        keyMechanics: ['audio', 'music'],
        assetPlan: {
          existingAssetsToUse: ['selected impossible visual asset'],
          assetsToGenerate: ['music loop'],
          visualStyle: 'audio'
        }
      })
    },
    check: (out) => {
      assert.ok(out.missingAssets.some((asset) => asset.role === 'audio'));
    }
  }
];

let failed = 0;
for (const testCase of cases) {
  try {
    const out = resolveAssetsForBrief({ ...testCase.body, debug: true });
    testCase.check(out);
    assert.ok(out.meta.evaluatedAssets <= Math.max(1, out.requirements.length) * 240);
    console.log(`PASS ${testCase.name}: intent=${out.meta.intent}, selected=${out.selectedAssets.length}, missing=${out.missingAssets.length}, evaluated=${out.meta.evaluatedAssets}/${out.meta.totalAssets}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${testCase.name}: ${err.message}`);
  }
}

if (failed > 0) process.exitCode = 1;
