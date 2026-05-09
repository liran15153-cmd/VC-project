/* ============================================================================
   Deterministic Mock AI / Local Fallback Service
   ----------------------------------------------------------------------------
   Used for local development, automated tests, token-saving hybrid steps, and
   emergency fallback when OpenRouter is unavailable.
   ========================================================================= */

const genre2D = ['platformer', 'shooter', 'runner', 'breakout', 'rpg', 'puzzle'];
const genre3D = ['explorer-fp', 'adventure-tp', 'platformer-3d', 'runner-3d', 'racing', 'flying'];

const PALETTES = [
  { player: 0x38bdf8, enemy: 0xef4444, ground: 0x166534, collectible: 0xfacc15, bg: '#0f172a' },
  { player: 0xa78bfa, enemy: 0xf97316, ground: 0x1e3a5f, collectible: 0x34d399, bg: '#0d1117' },
  { player: 0xfbbf24, enemy: 0xdc2626, ground: 0x374151, collectible: 0x60a5fa, bg: '#111827' },
  { player: 0x4ade80, enemy: 0xf43f5e, ground: 0x713f12, collectible: 0xe879f9, bg: '#1a0a2e' },
  { player: 0xfb923c, enemy: 0x7c3aed, ground: 0x1f2937, collectible: 0x22d3ee, bg: '#030712' },
];

const MOCK_CREATED_AT = '2024-01-01T00:00:00.000Z';

function createRng(seedText) {
  let seed = 2166136261;
  for (const char of String(seedText || 'fallback')) {
    seed ^= char.charCodeAt(0);
    seed = Math.imul(seed, 16777619);
  }
  return function rng() {
    seed += 0x6D2B79F5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }
function rnd(min, max, rng) { return Math.floor(rng() * (max - min + 1)) + min; }

function shouldUseFallback(err) {
  const message = String(err?.message || err || '').toLowerCase();
  const code = String(err?.code || '').toLowerCase();
  return (
    code === 'service_unavailable' ||
    message.includes('429') ||
    message.includes('quota') ||
    message.includes('too many requests') ||
    message.includes('rate-limit') ||
    message.includes('rate limit') ||
    message.includes('service_unavailable') ||
    message.includes('invalid json') ||
    message.includes('failed schema validation') ||
    message.includes('schema validation') ||
    message.includes('after repair') ||
    message.includes('expected') && message.includes('json')
  );
}

function inferDifficulty(answers = {}, prompt = '') {
  const text = `${prompt} ${Object.values(answers).join(' ')}`.toLowerCase();
  if (text.includes('hard') || text.includes('difficult')) return 'hard';
  if (text.includes('easy') || text.includes('simple')) return 'easy';
  return 'medium';
}

function normalizeGenre(gameType, dimension) {
  const list = dimension === '3D' ? genre3D : genre2D;
  return list.includes(gameType) ? gameType : list[0];
}

function titleFromPrompt(prompt, dimension) {
  const cleaned = String(prompt || '')
    .replace(/build|create|make|game|please|me|with|and|the|a|an/gi, ' ')
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join(' ');
  return cleaned ? `${cleaned} ${dimension}` : `Demo ${dimension} Game`;
}

function generateMCQ({ prompt, gameType, dimension }) {
  return {
    questions: [
      {
        id: 'dimension',
        question: 'Which presentation fits this idea best?',
        options: [
          { id: 'A', label: 'Fast, readable 2D game', value: '2D' },
          { id: 'B', label: 'Explorable 3D game', value: '3D' }
        ]
      },
      {
        id: 'difficulty',
        question: 'How challenging should the first playable version feel?',
        options: [
          { id: 'A', label: 'Easy and approachable', value: 'easy' },
          { id: 'B', label: 'Medium with real tension', value: 'medium' }
        ]
      },
      {
        id: 'pace',
        question: 'What pace should drive the core loop?',
        options: [
          { id: 'A', label: 'Fast action', value: 'fast' },
          { id: 'B', label: 'Exploration and discovery', value: 'exploration' }
        ]
      },
      {
        id: 'goal',
        question: 'What should the player mainly do?',
        options: [
          { id: 'A', label: 'Collect and survive', value: 'collect_and_survive' },
          { id: 'B', label: 'Reach a clear goal', value: 'reach_goal' }
        ]
      },
      {
        id: 'visual_style',
        question: 'Which visual direction should guide assets?',
        options: [
          { id: 'A', label: 'Colorful fantasy', value: 'fantasy' },
          { id: 'B', label: 'Clean sci-fi', value: 'sci_fi' }
        ]
      },
      {
        id: 'player_power',
        question: 'How should the player character feel?',
        options: [
          { id: 'A', label: 'Agile and expressive', value: 'agile' },
          { id: 'B', label: 'Strong and tactical', value: 'tactical' }
        ]
      }
    ],
    meta: {
      model: 'local-mock',
      source: 'mock',
      reason: 'deterministic local helper',
      prompt,
      gameType,
      dimension
    }
  };
}

function generateGame({ prompt, answers = {}, gameType, dimension }) {
  const rng = createRng(JSON.stringify({ prompt, answers, gameType, dimension }));
  const dim = dimension === '3D' ? '3D' : '2D';
  const genre = normalizeGenre(gameType, dim);
  const difficulty = answers.difficulty || inferDifficulty(answers, prompt);
  return dim === '3D'
    ? generate3DGame({ prompt, answers, genre, difficulty, rng })
    : generate2DGame({ prompt, answers, genre, difficulty, rng });
}

function generateBrief({ prompt, answers = {}, gameType, dimension, existingAssets = [] }) {
  const dim = dimension || answers.dimension || '2D';
  const genre = gameType || answers.genre || (dim === '3D' ? 'adventure-tp' : 'platformer');
  const title = titleFromPrompt(prompt, 'Brief');
  const assetNames = existingAssets.slice(0, 5).map((asset) => asset.name || asset.id);

  return {
    brief: {
      title,
      oneSentencePitch: `A focused ${dim} ${genre} built around ${String(prompt).slice(0, 120)}.`,
      playerFantasy: answers.player_power === 'tactical'
        ? 'Feel clever, capable, and in control under pressure.'
        : 'Feel agile, expressive, and rewarded for clean movement.',
      targetPlatform: 'mobile-first',
      dimension: dim === '3D' ? '3D' : dim === 'hybrid' ? 'hybrid' : '2D',
      genre,
      coreLoop: [
        'Read the immediate objective',
        'Move through a compact challenge space',
        'Collect or interact with the goal object',
        'Avoid hazards or enemies',
        'Reach a win state and restart quickly'
      ],
      keyMechanics: [
        'Responsive movement',
        'Clear collectible or objective feedback',
        'Simple enemy or hazard pressure',
        'Short level completion loop'
      ],
      controls: {
        primary: 'Keyboard movement with one action button',
        mobile: 'Virtual joystick plus one large action button',
        accessibilityNotes: ['Large touch targets', 'Readable contrast', 'Short restart loop']
      },
      runtimePlan: {
        runtime: 'hybrid',
        phaserRole: '2D scene orchestration, HUD, sprite/tilemap rendering, and input affordances',
        threeRole: '3D scene rendering when the brief needs depth, camera, lighting, or primitive meshes',
        rapierRole: 'Shared deterministic collision and physics rules for movement, hazards, and pickups',
        godotStyleGenerationNotes: 'Generate editable scenes from small nodes/components rather than opaque code blobs',
        systems: ['input', 'physics', 'camera', 'objectives', 'spawning', 'ui']
      },
      assetPlan: {
        existingAssetsToUse: assetNames,
        assetsToGenerate: ['player character', 'main collectible', 'hazard/enemy', 'background or level tiles'],
        visualStyle: answers.visual_style || 'clean readable arcade style with strong silhouettes'
      },
      missingInfo: ['Exact win condition', 'Preferred art style', 'Session length target'],
      followUpQuestions: generateMCQ({ prompt, gameType, dimension }).questions.slice(1, 5),
      productionNotes: [
        'Keep the first version small enough to validate the core loop before building content scale',
        'Represent generated content as editable JSON/components, not opaque source code',
        'Use existing assets before generating new ones when they match the brief'
      ],
      nonGoals: ['full game code generation', 'multiplayer infrastructure', 'marketplace publishing']
    }
  };
}

function safeStructuredError(message) {
  return {
    error: {
      code: 'AI_BRIEF_UNAVAILABLE',
      message,
      recoverable: true
    }
  };
}

function generate2DGame({ prompt, answers, genre, difficulty, rng }) {
  const fast = answers.pace === 'fast';
  const palette = pick(PALETTES, rng);

  const groundY = rnd(500, 530, rng);
  const platforms = [
    { x: 480, y: groundY, width: rnd(800, 920, rng) },
    { x: rnd(160, 280, rng), y: groundY - rnd(80, 130, rng), width: rnd(180, 260, rng) },
    { x: rnd(400, 560, rng), y: groundY - rnd(160, 230, rng), width: rnd(200, 290, rng) },
    { x: rnd(650, 800, rng), y: groundY - rnd(240, 310, rng), width: rnd(160, 220, rng) },
  ];

  return {
    metadata: {
      gameTitle: titleFromPrompt(prompt, '2D'),
      description: `Fallback game generated from: ${prompt}`,
      genre,
      engine: 'phaser',
      dimension: '2D',
      difficulty,
      estimatedPlaytime: '5-10 minutes',
      version: '1.0',
      createdAt: MOCK_CREATED_AT
    },
    gameConfig: {
      width: 960,
      height: 540,
      backgroundColor: palette.bg,
      physics: { system: 'arcade', gravity: rnd(750, 950, rng), debug: false }
    },
    player: {
      color: palette.player,
      speed: fast ? rnd(300, 360, rng) : rnd(220, 280, rng),
      jumpVelocity: fast ? -rnd(580, 640, rng) : -rnd(490, 550, rng),
      lives: difficulty === 'hard' ? 2 : 3,
      size: { width: rnd(28, 38, rng), height: rnd(40, 52, rng) }
    },
    enemies: {
      color: palette.enemy,
      count: difficulty === 'easy' ? rnd(2, 4, rng) : difficulty === 'hard' ? rnd(6, 9, rng) : rnd(4, 6, rng),
      spawnRate: fast ? rnd(1500, 2200, rng) : rnd(2200, 3200, rng),
      speed: fast ? rnd(100, 140, rng) : rnd(60, 100, rng),
      behavior: 'patrol'
    },
    collectibles: {
      color: palette.collectible,
      count: difficulty === 'hard' ? rnd(9, 12, rng) : rnd(6, 9, rng),
      value: rnd(5, 20, rng),
      type: 'gem'
    },
    level: {
      platforms,
      obstacles: [{ x: rnd(600, 720, rng), y: groundY - 28 }, { x: rnd(300, 420, rng), y: groundY - rnd(100, 120, rng) }],
      walls: [],
      theme: prompt.slice(0, 30)
    },
    ui: { showScore: true, showLives: true, showTimer: false, showMinimap: false, fontFamily: 'Arial', primaryColor: '#ffffff', secondaryColor: '#93c5fd' },
    controls: { scheme: 'both', actionKey: 'SPACE' },
    audio: { musicEnabled: false, sfxEnabled: false, theme: 'adventure' }
  };
}

function generate3DGame({ prompt, answers, genre, difficulty, rng }) {
  const fast = answers.pace === 'fast';
  const palette = pick(PALETTES, rng);
  const groundSize = rnd(70, 110, rng);
  const collectibleCount = difficulty === 'hard' ? rnd(9, 12, rng) : rnd(6, 9, rng);
  const enemyCount = difficulty === 'easy' ? rnd(2, 3, rng) : difficulty === 'hard' ? rnd(5, 7, rng) : rnd(3, 5, rng);
  const spread = rnd(7, 13, rng);

  return {
    metadata: {
      gameTitle: titleFromPrompt(prompt, '3D'),
      description: `Fallback 3D game generated from: ${prompt}`,
      genre,
      engine: 'threejs',
      dimension: '3D',
      difficulty,
      estimatedPlaytime: '5-10 minutes',
      version: '1.0',
      createdAt: MOCK_CREATED_AT
    },
    scene: {
      backgroundColor: palette.bg,
      fog: { enabled: true, color: palette.bg, near: rnd(15, 25, rng), far: rnd(100, 140, rng) },
      skybox: 'none'
    },
    camera: {
      type: 'third-person',
      fov: rnd(65, 82, rng),
      near: 0.1,
      far: 500,
      initialPosition: { x: 0, y: rnd(6, 9, rng), z: rnd(11, 15, rng) }
    },
    lighting: {
      ambient: { color: '#ffffff', intensity: rnd(50, 75, rng) / 100 },
      directional: { color: '#ffffff', intensity: rnd(85, 120, rng) / 100, position: { x: rnd(5, 12, rng), y: rnd(10, 18, rng), z: rnd(5, 10, rng) }, castShadow: true },
      mood: 'dynamic'
    },
    player: {
      model: 'box',
      color: palette.player,
      size: { width: 1, height: 2, depth: 1 },
      moveSpeed: fast ? rnd(10, 14, rng) : rnd(7, 10, rng),
      jumpForce: rnd(10, 14, rng),
      lives: difficulty === 'hard' ? 2 : 3
    },
    physics: { gravity: { x: 0, y: rnd(-11, -8, rng), z: 0 }, playerCollider: 'box' },
    world: {
      ground: { type: 'plane', size: groundSize, color: palette.ground },
      obstacles: Array.from({ length: rnd(2, 5, rng) }, (_, i) => ({
        type: 'box',
        position: { x: rnd(-12, 12, rng), y: rnd(1, 2, rng), z: rnd(-12, 12, rng) },
        size: { width: rnd(2, 4, rng), height: rnd(2, 4, rng), depth: rnd(1, 3, rng) },
        color: rnd(0x334155, 0x64748b, rng),
        isStatic: true
      })),
      collectibles: Array.from({ length: collectibleCount }, (_, i) => ({
        type: 'gem',
        position: { x: Math.cos((i / collectibleCount) * Math.PI * 2) * spread, y: 0.8, z: Math.sin((i / collectibleCount) * Math.PI * 2) * spread },
        color: palette.collectible,
        value: rnd(5, 15, rng)
      }))
    },
    enemies: {
      model: 'box',
      color: palette.enemy,
      count: enemyCount,
      spawnPositions: Array.from({ length: Math.max(2, enemyCount) }, (_, i) => ({
        x: Math.cos((i / enemyCount) * Math.PI * 2) * (spread + 3),
        y: 1,
        z: Math.sin((i / enemyCount) * Math.PI * 2) * (spread + 3)
      })),
      moveSpeed: fast ? rnd(3, 5, rng) : rnd(1, 3, rng),
      behavior: 'wander'
    },
    ui: { showCrosshair: false, showHUD: true, showCompass: true, showFPS: false },
    controls: { scheme: 'third-person', mouseLook: true, actionKey: 'SPACE' }
  };
}

function editGame({ gameJSON, editPrompt }) {
  const updated = JSON.parse(JSON.stringify(gameJSON));
  updated.metadata = updated.metadata || {};
  updated.metadata.updatedAt = new Date().toISOString();
  updated.metadata.version = bumpVersion(updated.metadata.version);
  updated.metadata.description = `${updated.metadata.description || 'Edited game'} | Edit: ${editPrompt}`;

  const lower = String(editPrompt || '').toLowerCase();
  if (updated.metadata.dimension === '2D') {
    if (lower.includes('slow') && updated.enemies) {
      updated.enemies.speed = Math.max(20, (updated.enemies.speed || 80) - 25);
    }
    if (lower.includes('potion') || lower.includes('collectible')) {
      updated.collectibles = updated.collectibles || { color: 0xfacc15, count: 6, value: 10, type: 'coin' };
      updated.collectibles.count = Math.min(50, (updated.collectibles.count || 0) + 3);
      updated.collectibles.type = 'health_potion';
      updated.collectibles.color = 0x22c55e;
    }
  } else {
    if (lower.includes('slow') && updated.enemies) {
      updated.enemies.moveSpeed = Math.max(0.5, (updated.enemies.moveSpeed || 2) - 0.5);
    }
    if (lower.includes('potion') || lower.includes('collectible')) {
      updated.world = updated.world || {};
      updated.world.collectibles = updated.world.collectibles || [];
      updated.world.collectibles.push({
        type: 'health_potion',
        position: { x: 3, y: 0.8, z: -3 },
        color: 0x22c55e,
        value: 25
      });
    }
  }

  return updated;
}

function bumpVersion(version = '1.0') {
  const [major, minor] = String(version).split('.').map((n) => Number(n));
  if (!Number.isFinite(major)) return '1.1';
  return `${major}.${Number.isFinite(minor) ? minor + 1 : 1}`;
}

module.exports = {
  shouldUseFallback,
  generateMCQ,
  generateBrief,
  generateGame,
  editGame,
  createRng,
  safeStructuredError
};
