const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(os.tmpdir(), `gvc-backend-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
process.env.AUTH_TOKEN_SECRET = 'test-secret-that-is-long-enough-for-auth';
process.env.DEFAULT_FREE_TOKENS = '25';
process.env.TOKEN_ENFORCEMENT_ENABLED = 'true';
process.env.AUTO_ADMIN_FIRST_USER = 'true';
process.env.ADMIN_EMAILS = 'admin@example.com';
process.env.LOG_LEVEL = 'fatal';
process.env.AI_PROVIDER = 'openrouter';
process.env.OPENAI_API_KEY = 'replace-with-your-openai-api-key';
process.env.OPENROUTER_API_KEY = 'replace-with-your-openrouter-api-key';

const db = require('../src/db/connection');
const { createApp } = require('../src/app');
const { validateEngineGameDefinitionSafe } = require('../src/schemas/engineGameDefinitionSchema');

let server;
let baseUrl;

test.before(async () => {
  db.init();
  const app = createApp();
  server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  db.close();
  for (const suffix of ['', '-shm', '-wal']) {
    try {
      fs.rmSync(`${process.env.DATABASE_PATH}${suffix}`, { force: true });
    } catch {
      // ignore cleanup errors
    }
  }
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

test('engine generation endpoint requires auth and validates input before OpenAI', async () => {
  const unauthenticated = await request('POST', '/api/engine/generate', {
    body: { prompt: '' }
  });
  assert.equal(unauthenticated.res.status, 401);

  const user = await request('POST', '/api/auth/register', {
    body: { email: 'engine-validator@example.com', password: 'password123' }
  });
  assert.equal(user.res.status, 201);

  const generated = await request('POST', '/api/engine/generate', {
    token: user.data.token,
    body: { prompt: '' }
  });

  assert.equal(generated.res.status, 400);
  assert.equal(generated.data.code, 'VALIDATION_ERROR');
});

test('engine generation endpoint reports a clear error when AI provider key is missing', async () => {
  const user = await request('POST', '/api/auth/register', {
    body: { email: 'engine-provider@example.com', password: 'password123' }
  });
  assert.equal(user.res.status, 201);

  const generated = await request('POST', '/api/engine/generate', {
    token: user.data.token,
    body: { prompt: 'Create a simple platformer with coins and a win condition' }
  });

  assert.equal(generated.res.status, 503);
  assert.equal(generated.data.code, 'SERVICE_UNAVAILABLE');
  assert.match(generated.data.error, /OpenRouter|OPENROUTER_API_KEY/i);
});

test('auth, ownership, tokens, and admin stats', async () => {
  const adminReg = await request('POST', '/api/auth/register', {
    body: { email: 'admin@example.com', password: 'password123', displayName: 'Admin' }
  });
  assert.equal(adminReg.res.status, 201);
  assert.equal(adminReg.data.user.role, 'admin');
  assert.equal(adminReg.data.tokens.tokensRemaining, 25);
  assert.ok(adminReg.data.token);

  const userReg = await request('POST', '/api/auth/register', {
    body: { email: 'user@example.com', password: 'password123', displayName: 'User' }
  });
  assert.equal(userReg.res.status, 201);
  assert.equal(userReg.data.user.role, 'user');

  const strangerReg = await request('POST', '/api/auth/register', {
    body: { email: 'stranger@example.com', password: 'password123', displayName: 'Stranger' }
  });
  assert.equal(strangerReg.res.status, 201);

  const unauthList = await request('GET', '/api/games');
  assert.equal(unauthList.res.status, 401);

  const created = await request('POST', '/api/games', {
    token: userReg.data.token,
    body: {
      title: 'Test Runner',
      gameJSON: sampleGameJSON(),
      prompt: 'make a test platformer'
    }
  });
  assert.equal(created.res.status, 201);
  assert.ok(created.data.id);
  assert.ok(created.data.htmlString.includes('Phaser.Game'));
  assert.ok(Array.isArray(created.data.assetManifest));
  assert.ok(created.data.assetManifest.length >= 2);
  assert.equal(created.data.userId, userReg.data.user.id);

  const ownerRead = await request('GET', `/api/games/${created.data.id}`, { token: userReg.data.token });
  assert.equal(ownerRead.res.status, 200);
  assert.equal(ownerRead.data.id, created.data.id);

  const assets = await request('GET', `/api/games/${created.data.id}/assets`, { token: userReg.data.token });
  assert.equal(assets.res.status, 200);
  assert.equal(assets.data.gameId, created.data.id);
  assert.ok(assets.data.assets.some((asset) => asset.key === 'player'));

  const download = await fetch(`${baseUrl}/api/games/${created.data.id}/download`, {
    headers: { Authorization: `Bearer ${userReg.data.token}` }
  });
  assert.equal(download.status, 200);
  assert.equal(download.headers.get('content-type'), 'application/zip');
  assert.ok((await download.arrayBuffer()).byteLength > 100);

  const strangerRead = await request('GET', `/api/games/${created.data.id}`, { token: strangerReg.data.token });
  assert.equal(strangerRead.res.status, 403);

  const userStats = await request('GET', '/api/stats', { token: userReg.data.token });
  assert.equal(userStats.res.status, 403);

  const adminStats = await request('GET', '/api/stats', { token: adminReg.data.token });
  assert.equal(adminStats.res.status, 200);
  assert.equal(adminStats.data.users.total, 5);
  assert.equal(adminStats.data.games.total, 1);

  const grant = await request('POST', '/api/user/tokens/grant', {
    token: adminReg.data.token,
    body: { userId: userReg.data.user.id, amount: 10 }
  });
  assert.equal(grant.res.status, 200);
  assert.equal(grant.data.tokensRemaining, 35);
});
