/* ============================================================================
   Local AI Fallback Service
   ----------------------------------------------------------------------------
   Used for local product testing when the AI provider blocks generation.
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

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

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
    message.includes('service_unavailable')
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
        question: 'איזה סגנון תצוגה מתאים למשחק?',
        options: dimension
          ? [{ id: 'A', label: dimension, value: dimension }]
          : [
              { id: 'A', label: 'משחק 2D מהיר ופשוט', value: '2D' },
              { id: 'B', label: 'עולם 3D שאפשר לחקור', value: '3D' }
            ]
      },
      {
        id: 'difficulty',
        question: 'כמה מאתגר המשחק צריך להיות?',
        options: [
          { id: 'A', label: 'קל ונגיש', value: 'easy' },
          { id: 'B', label: 'בינוני עם אתגר', value: 'medium' }
        ]
      },
      {
        id: 'pace',
        question: 'מה הקצב של המשחק?',
        options: [
          { id: 'A', label: 'מהיר ואקשן', value: 'fast' },
          { id: 'B', label: 'רגוע וחקרני', value: 'exploration' }
        ]
      },
      {
        id: 'goal',
        question: 'מה המטרה המרכזית?',
        options: [
          { id: 'A', label: 'לאסוף פריטים ולשרוד', value: 'collect_and_survive' },
          { id: 'B', label: 'להגיע לסוף השלב', value: 'reach_goal' }
        ]
      },
      {
        id: 'visual_style',
        question: 'איזה אופי ויזואלי מתאים?',
        options: [
          { id: 'A', label: 'פנטזיה צבעונית', value: 'fantasy' },
          { id: 'B', label: 'מדע בדיוני נקי', value: 'sci_fi' }
        ]
      },
      {
        id: 'player_power',
        question: 'מה השחקן צריך להרגיש?',
        options: [
          { id: 'A', label: 'זריז וקופצני', value: 'agile' },
          { id: 'B', label: 'חזק וזהיר', value: 'tactical' }
        ]
      }
    ],
    meta: {
      model: 'local-fallback',
      source: 'fallback',
      reason: 'AI provider unavailable or quota-limited',
      prompt,
      gameType,
      dimension
    }
  };
}

function generateGame({ prompt, answers = {}, gameType, dimension }) {
  const dim = dimension === '3D' ? '3D' : '2D';
  const genre = normalizeGenre(gameType, dim);
  const difficulty = answers.difficulty || inferDifficulty(answers, prompt);
  return dim === '3D'
    ? generate3DGame({ prompt, answers, genre, difficulty })
    : generate2DGame({ prompt, answers, genre, difficulty });
}

function generate2DGame({ prompt, answers, genre, difficulty }) {
  const fast = answers.pace === 'fast';
  const palette = pick(PALETTES);

  // Randomised platform layout so each fallback looks different
  const groundY = rnd(500, 530);
  const platforms = [
    { x: 480, y: groundY, width: rnd(800, 920) },
    { x: rnd(160, 280), y: groundY - rnd(80, 130), width: rnd(180, 260) },
    { x: rnd(400, 560), y: groundY - rnd(160, 230), width: rnd(200, 290) },
    { x: rnd(650, 800), y: groundY - rnd(240, 310), width: rnd(160, 220) },
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
      createdAt: new Date().toISOString()
    },
    gameConfig: {
      width: 960,
      height: 540,
      backgroundColor: palette.bg,
      physics: { system: 'arcade', gravity: rnd(750, 950), debug: false }
    },
    player: {
      color: palette.player,
      speed: fast ? rnd(300, 360) : rnd(220, 280),
      jumpVelocity: fast ? -rnd(580, 640) : -rnd(490, 550),
      lives: difficulty === 'hard' ? 2 : 3,
      size: { width: rnd(28, 38), height: rnd(40, 52) }
    },
    enemies: {
      color: palette.enemy,
      count: difficulty === 'easy' ? rnd(2, 4) : difficulty === 'hard' ? rnd(6, 9) : rnd(4, 6),
      spawnRate: fast ? rnd(1500, 2200) : rnd(2200, 3200),
      speed: fast ? rnd(100, 140) : rnd(60, 100),
      behavior: 'patrol'
    },
    collectibles: {
      color: palette.collectible,
      count: difficulty === 'hard' ? rnd(9, 12) : rnd(6, 9),
      value: rnd(5, 20),
      type: 'gem'
    },
    level: {
      platforms,
      obstacles: [{ x: rnd(600, 720), y: groundY - 28 }, { x: rnd(300, 420), y: groundY - rnd(100, 120) }],
      walls: [],
      theme: prompt.slice(0, 30)
    },
    ui: { showScore: true, showLives: true, showTimer: false, showMinimap: false, fontFamily: 'Arial', primaryColor: '#ffffff', secondaryColor: '#93c5fd' },
    controls: { scheme: 'both', actionKey: 'SPACE' },
    audio: { musicEnabled: false, sfxEnabled: false, theme: 'adventure' }
  };
}

function generate3DGame({ prompt, answers, genre, difficulty }) {
  const fast = answers.pace === 'fast';
  const palette = pick(PALETTES);
  const groundSize = rnd(70, 110);
  const collectibleCount = difficulty === 'hard' ? rnd(9, 12) : rnd(6, 9);
  const enemyCount = difficulty === 'easy' ? rnd(2, 3) : difficulty === 'hard' ? rnd(5, 7) : rnd(3, 5);
  const spread = rnd(7, 13);

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
      createdAt: new Date().toISOString()
    },
    scene: {
      backgroundColor: palette.bg,
      fog: { enabled: true, color: palette.bg, near: rnd(15, 25), far: rnd(100, 140) },
      skybox: 'none'
    },
    camera: {
      type: 'third-person',
      fov: rnd(65, 82),
      near: 0.1,
      far: 500,
      initialPosition: { x: 0, y: rnd(6, 9), z: rnd(11, 15) }
    },
    lighting: {
      ambient: { color: '#ffffff', intensity: rnd(50, 75) / 100 },
      directional: { color: '#ffffff', intensity: rnd(85, 120) / 100, position: { x: rnd(5, 12), y: rnd(10, 18), z: rnd(5, 10) }, castShadow: true },
      mood: 'dynamic'
    },
    player: {
      model: 'box',
      color: palette.player,
      size: { width: 1, height: 2, depth: 1 },
      moveSpeed: fast ? rnd(10, 14) : rnd(7, 10),
      jumpForce: rnd(10, 14),
      lives: difficulty === 'hard' ? 2 : 3
    },
    physics: { gravity: { x: 0, y: rnd(-11, -8), z: 0 }, playerCollider: 'box' },
    world: {
      ground: { type: 'plane', size: groundSize, color: palette.ground },
      obstacles: Array.from({ length: rnd(2, 5) }, (_, i) => ({
        type: 'box',
        position: { x: rnd(-12, 12), y: rnd(1, 2), z: rnd(-12, 12) },
        size: { width: rnd(2, 4), height: rnd(2, 4), depth: rnd(1, 3) },
        color: rnd(0x334155, 0x64748b),
        isStatic: true
      })),
      collectibles: Array.from({ length: collectibleCount }, (_, i) => ({
        type: 'gem',
        position: { x: Math.cos((i / collectibleCount) * Math.PI * 2) * spread, y: 0.8, z: Math.sin((i / collectibleCount) * Math.PI * 2) * spread },
        color: palette.collectible,
        value: rnd(5, 15)
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
      moveSpeed: fast ? rnd(3, 5) : rnd(1, 3),
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
  generateGame,
  editGame
};
