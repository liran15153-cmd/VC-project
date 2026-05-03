const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'fatal';
process.env.AI_PROVIDER = 'openrouter';
process.env.OPENAI_API_KEY = 'replace-with-your-openai-api-key';
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

test('GAME_ENGINE GameDefinition validator accepts runtime schema and rejects old prototype schema', () => {
  const valid = validateEngineGameDefinitionSafe(sampleEngineGameDefinition());
  assert.equal(valid.ok, true);
  assert.equal(valid.data.initialScene, 'main');

  const oldFormat = validateEngineGameDefinitionSafe(sampleGameJSON());
  assert.equal(oldFormat.ok, false);
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
