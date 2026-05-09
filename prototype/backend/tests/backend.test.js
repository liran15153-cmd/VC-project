const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'fatal';
process.env.AI_MODE = 'real';
process.env.AI_FALLBACK_ENABLED = 'true';
process.env.OPENROUTER_API_KEY = 'replace-with-your-openrouter-api-key';

const { createApp } = require('../src/app');
const { validateEngineGameDefinitionSafe } = require('../src/schemas/engineGameDefinitionSchema');

let server;
let baseUrl;

test.before(async () => {
  const app = createApp();
  server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function request(method, pathname, { body, token } = {}) {
  const res = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();
  return { res, data };
}

function sampleGameJSON() {
  return {
    metadata: {
      gameTitle: 'Test Runner',
      description: 'A generated test game',
      genre: 'platformer',
      engine: 'phaser',
      dimension: '2D',
      difficulty: 'easy',
      estimatedPlaytime: '5 minutes'
    },
    gameConfig: {
      width: 800,
      height: 600,
      backgroundColor: '#111827',
      physics: { system: 'arcade', gravity: 800, debug: false }
    },
    player: {
      color: 0x38bdf8,
      speed: 260,
      jumpVelocity: -520,
      lives: 3,
      size: { width: 32, height: 48 }
    },
    enemies: { color: 0xef4444, count: 2, spawnRate: 2500, speed: 80, behavior: 'patrol' },
    collectibles: { color: 0xfacc15, count: 4, value: 10, type: 'coin' },
    level: { platforms: [{ x: 400, y: 580, width: 760 }], theme: 'test' },
    ui: { showScore: true, showLives: true },
    controls: { scheme: 'both', actionKey: 'SPACE' },
    audio: { musicEnabled: false, sfxEnabled: false, theme: 'none' }
  };
}

function sampleEngineGameDefinition() {
  return {
    schemaVersion: 1,
    metadata: {
      title: 'Engine Runner',
      description: 'A runtime GameDefinition test game',
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
      score: { type: 'number', initial: 0, min: 0 }
    },
    inputBindings: {
      moveLeft: ['ArrowLeft', 'KeyA'],
      moveRight: ['ArrowRight', 'KeyD'],
      jump: ['Space']
    },
    prefabs: {
      coin: {
        tags: ['coin'],
        mesh: { shape: 'sphere', radius: 0.3, color: '#facc15' },
        rigidBody: { type: 'static', collider: { shape: 'ball', radius: 0.3 }, colliderOptions: { sensor: true } }
      }
    },
    behaviors: [
      { trigger: { type: 'inputDown', input: 'moveLeft' }, actions: [{ type: 'setVelocityX', target: 'player', value: -4 }] },
      { trigger: { type: 'inputDown', input: 'moveRight' }, actions: [{ type: 'setVelocityX', target: 'player', value: 4 }] },
      { trigger: { type: 'inputPressed', input: 'jump' }, actions: [{ type: 'applyImpulse', target: 'player', value: { x: 0, y: 7, z: 0 } }] },
      {
        trigger: { type: 'collision', entityTag: 'player', withTag: 'coin' },
        actions: [
          { type: 'incrementState', stateKey: 'score', amount: 1 },
          { type: 'destroyEntity', target: 'collisionOther' }
        ]
      },
      {
        trigger: { type: 'stateChange', stateKey: 'score' },
        conditions: [{ stateKey: 'score', gte: 1 }],
        actions: [{ type: 'switchScene', scene: 'win' }]
      }
    ],
    ui: [{ type: 'text', text: 'Score: {score}', x: 16, y: 16 }],
    scenes: [
      {
        key: 'main',
        systems: ['physicsSync', 'camera', 'behavior', 'spawner', 'ui'],
        entities: [
          {
            key: 'player',
            tags: ['player'],
            transform: { position: { x: 0, y: 2, z: 0 } },
            mesh: { shape: 'box', size: { x: 0.8, y: 1.2, z: 0.8 }, color: '#38bdf8' },
            rigidBody: { type: 'dynamic', collider: { shape: 'cuboid', halfExtents: { x: 0.4, y: 0.6, z: 0.4 } } },
            cameraTarget: { lerp: 5, offset: { x: 0, y: 4, z: 8 } }
          },
          {
            key: 'ground',
            tags: ['ground'],
            transform: { position: { x: 0, y: -0.25, z: 0 } },
            mesh: { shape: 'box', size: { x: 12, y: 0.5, z: 4 }, color: '#4a7c59' },
            rigidBody: { type: 'static', collider: { shape: 'cuboid', halfExtents: { x: 6, y: 0.25, z: 2 } } }
          }
        ],
        spawners: [{ prefab: 'coin', positions: [{ x: 2, y: 1, z: 0 }] }]
      },
      {
        key: 'win',
        entities: [{ key: 'win-text', sprite: { kind: 'text', text: 'Win!', x: 360, y: 240 } }]
      }
    ],
    initialScene: 'main'
  };
}

function sampleGameBrief() {
  return {
    title: 'Robot Garden Runner',
    oneSentencePitch: 'A tiny robot jumps through floating gardens to collect repair crystals.',
    playerFantasy: 'Feel like a nimble repair robot restoring a broken sky garden.',
    targetPlatform: 'desktop-first',
    dimension: '3D',
    genre: 'platformer-3d',
    coreLoop: ['Explore a short arena', 'Collect repair crystals', 'Avoid hazards', 'Reach the exit'],
    keyMechanics: ['jumping', 'collectibles', 'simple hazards'],
    controls: {
      primary: 'Arrow keys or WASD to move, Space to jump',
      mobile: 'Virtual stick and jump button',
      accessibilityNotes: []
    },
    runtimePlan: {
      runtime: 'hybrid',
      phaserRole: 'HUD and text overlays',
      threeRole: '3D garden world and asset models',
      rapierRole: 'Simple platformer collision and triggers',
      godotStyleGenerationNotes: 'Keep scenes declarative and editable.',
      systems: ['physicsSync', 'camera', 'behavior', 'ui']
    },
    assetPlan: {
      existingAssetsToUse: ['robot-like player prop', 'coin or crystal collectible', 'platform kit pieces'],
      assetsToGenerate: ['small visual effects only if needed'],
      visualStyle: 'bright low-poly platformer'
    },
    missingInfo: [],
    followUpQuestions: [
      { id: 'pace', question: 'What pace?', options: [{ id: 'A', label: 'Relaxed', value: 'relaxed' }, { id: 'B', label: 'Fast', value: 'fast' }] },
      { id: 'danger', question: 'How dangerous?', options: [{ id: 'A', label: 'Low', value: 'low' }, { id: 'B', label: 'High', value: 'high' }] },
      { id: 'goal', question: 'Main goal?', options: [{ id: 'A', label: 'Collect', value: 'collect' }, { id: 'B', label: 'Escape', value: 'escape' }] }
    ],
    productionNotes: ['Use primitive colliders.', 'Keep first preview small.'],
    nonGoals: ['No full editor in this step']
  };
}

test('GAME_ENGINE GameDefinition validator accepts runtime schema and rejects old prototype schema', () => {
  const valid = validateEngineGameDefinitionSafe(sampleEngineGameDefinition());
  assert.equal(valid.ok, true);
  assert.equal(valid.data.initialScene, 'main');

  const oldFormat = validateEngineGameDefinitionSafe(sampleGameJSON());
  assert.equal(oldFormat.ok, false);
});

test('GAME_ENGINE validator accepts declared GLB model entities and rejects missing model assets', () => {
  const withModel = sampleEngineGameDefinition();
  withModel.assets = [{ key: 'crate-model', type: 'gltf', url: '/assets/library/kenney-platformer-kit/models/glb-format/crate.glb' }];
  withModel.scenes[0].entities[0].model = {
    assetKey: 'crate-model',
    scale: { x: 1, y: 1, z: 1 }
  };
  delete withModel.scenes[0].entities[0].mesh;

  const valid = validateEngineGameDefinitionSafe(withModel);
  assert.equal(valid.ok, true);
  assert.equal(valid.data.scenes[0].entities[0].model.assetKey, 'crate-model');

  withModel.scenes[0].entities[0].model.assetKey = 'missing-model';
  const invalid = validateEngineGameDefinitionSafe(withModel);
  assert.equal(invalid.ok, false);
  assert.match(invalid.errors[0].message, /missing model asset/i);
});

test('health endpoint reports Supabase-owned services as pending', async () => {
  const health = await request('GET', '/api/health');
  assert.equal(health.res.status, 200);
  assert.equal(health.data.status, 'ok');
  assert.equal(health.data.services.database, 'supabase_pending');
  assert.equal(health.data.services.auth, 'supabase_pending');
  assert.equal(health.data.services.storage, 'supabase_pending');
});

test('engine generation endpoint validates input before OpenAI', async () => {
  const generated = await request('POST', '/api/engine/generate', {
    body: { prompt: '' }
  });

  assert.equal(generated.res.status, 400);
  assert.equal(generated.data.code, 'VALIDATION_ERROR');
});

test('engine generation endpoint reports a clear error when AI provider key is missing', async () => {
  const generated = await request('POST', '/api/engine/generate', {
    body: { prompt: 'Create a simple platformer with coins and a win condition' }
  });

  assert.equal(generated.res.status, 503);
  assert.equal(generated.data.code, 'SERVICE_UNAVAILABLE');
  assert.match(generated.data.error, /OpenRouter|OPENROUTER_API_KEY/i);
});

test('legacy local backend ownership endpoints are removed for Supabase', async () => {
  const auth = await request('POST', '/api/auth/register', {
    body: { email: 'user@example.com', password: 'password123' }
  });
  assert.equal(auth.res.status, 404);

  const games = await request('GET', '/api/games');
  assert.equal(games.res.status, 404);

  const tokens = await request('GET', '/api/user/tokens');
  assert.equal(tokens.res.status, 404);

  const stats = await request('GET', '/api/stats');
  assert.equal(stats.res.status, 404);
});

test('generate-game remains stateless and can fall back locally', async () => {
  const generated = await request('POST', '/api/generate-game', {
    body: {
      prompt: 'Create a simple platformer with coins',
      answers: {},
      gameType: 'platformer',
      dimension: '2D'
    }
  });

  assert.equal(generated.res.status, 200);
  assert.equal(generated.data.gameId, null);
  assert.equal(generated.data.meta.persistence, 'supabase_pending');
  assert.ok(generated.data.htmlString.includes('Phaser.Game'));
  assert.ok(Array.isArray(generated.data.assetManifest));
});

test('engine from-brief endpoint validates input before OpenAI', async () => {
  const generated = await request('POST', '/api/engine/from-brief', {
    body: { prompt: 'Create a preview without a brief' }
  });

  assert.equal(generated.res.status, 400);
  assert.equal(generated.data.code, 'VALIDATION_ERROR');
});

test('engine from-brief endpoint reports a clear error when AI provider key is missing', async () => {
  const generated = await request('POST', '/api/engine/from-brief', {
    body: {
      prompt: 'Create a tiny 3D platformer preview',
      answers: {},
      gameType: 'platformer-3d',
      dimension: '3D',
      brief: sampleGameBrief()
    }
  });

  assert.equal(generated.res.status, 503);
  assert.equal(generated.data.code, 'SERVICE_UNAVAILABLE');
  assert.match(generated.data.error, /OpenRouter|OPENROUTER_API_KEY/i);
});

test('questions endpoint falls back safely when real AI is unavailable', async () => {
  const generated = await request('POST', '/api/mcq/generate', {
    body: {
      prompt: 'Create a mobile platformer about collecting moon flowers',
      gameType: 'platformer',
      dimension: '2D'
    }
  });

  assert.equal(generated.res.status, 200);
  assert.equal(generated.data.meta.mode, 'real');
  assert.equal(generated.data.meta.fallback, true);
  assert.equal(generated.data.meta.model, 'local-mock');
  assert.ok(generated.data.questions.length >= 5);
});

test('game brief endpoint returns planning JSON without generating code', async () => {
  const generated = await request('POST', '/api/brief/generate', {
    body: {
      prompt: 'A cozy 3D mobile exploration game where a tiny robot repairs floating gardens',
      answers: { pace: 'exploration', visual_style: 'soft_sci_fi' },
      gameType: 'adventure-tp',
      dimension: '3D',
      existingAssets: [{ id: 'oak-preview', name: 'Oak Woods sample', type: 'image', tags: ['forest'] }]
    }
  });

  assert.equal(generated.res.status, 200);
  assert.equal(generated.data.meta.codeGenerated, false);
  assert.equal(generated.data.meta.fallback, true);
  assert.equal(generated.data.brief.runtimePlan.runtime, 'hybrid');
  assert.match(generated.data.brief.nonGoals.join(' '), /full game code generation/i);
});
