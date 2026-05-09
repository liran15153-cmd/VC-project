/* ============================================================================
   Mock AI Service
   ============================================================================
   Simulates a real AI by:
   - Generating MCQs from prompts (via MCQGenerator)
   - Generating game JSON based on prompt + MCQ answers
   - Running validation loop (via Validator)
   - Producing edits to existing games

   In production this would call OpenAI API with the system prompts.
   Here we use deterministic mock logic.
   ========================================================================= */

const MockAI = {

  USE_OPENAI: true,
  MCQ_ENDPOINT: 'http://localhost:3000/api/mcq/generate',
  GENERATE_ENDPOINT: 'http://localhost:3000/api/generate-game',
  EDIT_ENDPOINT: 'http://localhost:3000/api/edit-game',

  /**
   * Phase 1: Generate MCQ questions for a new game prompt
   */
  async generateMCQs(prompt) {
    await this.simulateThinking(500);
    if (this.USE_OPENAI) {
      try {
        const gameType = MCQGenerator.detectGameType(prompt);
        const dimension = MCQGenerator.detectDimension(prompt);
        const data = await this.postJSON(this.MCQ_ENDPOINT, { prompt, gameType, dimension });
        const payload = { gameType, dimension, questions: data.questions || [] };
        if (this.isValidMCQPayload(payload)) return payload;
      } catch (error) {
        console.warn('Backend MCQ failed, using local generator:', error);
      }
    }
    return MCQGenerator.generate(prompt);
  },

  /**
   * Phase 2: Generate the complete game JSON config
   * @param {string} prompt - Original user prompt
   * @param {object} mcqAnswers - Answers from MCQ flow {questionId: value}
   * @param {string} gameType - Detected game type
   * @param {string} dimension - "2D" or "3D"
   */
  async generateGame(prompt, mcqAnswers, gameType, dimension) {
    await this.simulateThinking(1500);

    if (this.USE_OPENAI) {
      try {
        // Use the dedicated generate-game endpoint with proper system prompts
        const systemPrompt = dimension === '3D'
          ? window.SYSTEM_PROMPT_3D
          : window.SYSTEM_PROMPT_2D;

        const data = await this.postJSON(this.GENERATE_ENDPOINT, {
          prompt,
          answers: mcqAnswers,
          gameType,
          dimension,
          systemPrompt
        });

        if (data.gameJSON) {
          const fixed = Validator.autoFix(data.gameJSON);
          const validation = Validator.validateGame(fixed);
          if (validation.valid) return fixed;
          console.warn('ג ן¸ Backend game JSON failed validation ג€” falling back to local builder:', validation.errors);
        }
      } catch (error) {
        console.warn('ג ן¸ Backend game generation error, using local builder:', error.message);
      }
    }

    // Build base game JSON
    let gameJSON;

    if (dimension === '3D') {
      gameJSON = this.build3DGame(prompt, mcqAnswers, gameType);
    } else {
      gameJSON = this.build2DGame(prompt, mcqAnswers, gameType);
    }

    // Run validation loop (simulating what the real AI would do)
    const validation = Validator.validateGame(gameJSON);

    if (!validation.valid) {
      // Auto-fix common issues
      gameJSON = Validator.autoFix(gameJSON);

      const revalidation = Validator.validateGame(gameJSON);
      if (!revalidation.valid) {
        // Fall back to safe template
        gameJSON = this.getFallbackGame(gameType, dimension);
      }
    }

    return gameJSON;
  },

  /**
   * Edit existing game based on user's edit prompt
   */
  async editGame(originalGame, editPrompt) {
    await this.simulateThinking(1200);

    if (this.USE_OPENAI) {
      try {
        // Use the dedicated edit-game endpoint with proper system prompts
        const dimension = originalGame?.metadata?.dimension || '2D';
        const systemPrompt = dimension === '3D'
          ? window.SYSTEM_PROMPT_3D
          : window.SYSTEM_PROMPT_2D;

        const data = await this.postJSON(this.EDIT_ENDPOINT, {
          gameJSON: originalGame,
          editPrompt,
          systemPrompt
        });

        if (data.gameJSON) {
          const fixed = Validator.autoFix(data.gameJSON);
          const validation = Validator.validateGame(fixed);
          if (validation.valid) return fixed;
          console.warn('ג ן¸ Backend edit JSON failed validation ג€” falling back to local editor:', validation.errors);
        }
      } catch (error) {
        console.warn('ג ן¸ Backend edit error, using local editor:', error.message);
      }
    }

    const cloned = JSON.parse(JSON.stringify(originalGame));
    const p = editPrompt.toLowerCase();

    // Apply edits based on natural language
    if (/(׳§׳©|׳§׳•׳©׳™|harder|difficult)/i.test(p)) {
      cloned.metadata.difficulty = 'hard';
      if (cloned.player) cloned.player.lives = Math.max(1, cloned.player.lives - 1);
      if (cloned.enemies) {
        cloned.enemies.speed = Math.min(300, (cloned.enemies.speed || 100) * 1.5);
        cloned.enemies.spawnRate = Math.max(500, (cloned.enemies.spawnRate || 1500) - 300);
      }
    }

    if (/(׳§׳|easier|simple)/i.test(p)) {
      cloned.metadata.difficulty = 'easy';
      if (cloned.player) cloned.player.lives = Math.min(5, cloned.player.lives + 1);
    }

    if (/(׳׳•׳™׳‘|enemy|enemies|׳׳₪׳׳¦)/i.test(p)) {
      if (/(׳™׳•׳×׳¨|more|add)/i.test(p) && cloned.enemies) {
        cloned.enemies.count = Math.min(15, (cloned.enemies.count || 3) + 2);
      }
      if (/(׳₪׳—׳•׳×|less|remove)/i.test(p) && cloned.enemies) {
        cloned.enemies.count = Math.max(1, (cloned.enemies.count || 3) - 2);
      }
    }

    if (/(׳׳˜׳‘׳¢|׳–׳”׳‘|coin|gold|׳׳•׳¦׳¨|treasure)/i.test(p)) {
      if (/(׳™׳•׳×׳¨|more|add)/i.test(p) && cloned.collectibles) {
        cloned.collectibles.count = Math.min(30, (cloned.collectibles.count || 10) + 5);
      }
    }

    if (/(׳—׳™׳™׳|lives|hp)/i.test(p)) {
      if (/(׳™׳•׳×׳¨|more|add)/i.test(p) && cloned.player) {
        cloned.player.lives = Math.min(5, cloned.player.lives + 1);
      }
      if (/(׳₪׳—׳•׳×|less)/i.test(p) && cloned.player) {
        cloned.player.lives = Math.max(1, cloned.player.lives - 1);
      }
    }

    if (/(׳׳”׳™׳¨|׳׳”׳™׳¨׳•׳×|fast|speed)/i.test(p) && cloned.player) {
      cloned.player.speed = Math.min(500, (cloned.player.speed || 200) + 50);
    }

    if (/(׳׳™׳˜׳™|slow)/i.test(p) && cloned.player) {
      cloned.player.speed = Math.max(50, (cloned.player.speed || 200) - 50);
    }

    // Color theme changes
    if (/(׳׳“׳•׳|red)/i.test(p)) this.applyColorTheme(cloned, 'red');
    if (/(׳›׳—׳•׳|blue)/i.test(p)) this.applyColorTheme(cloned, 'blue');
    if (/(׳™׳¨׳•׳§|green)/i.test(p)) this.applyColorTheme(cloned, 'green');
    if (/(׳¡׳’׳•׳|purple)/i.test(p)) this.applyColorTheme(cloned, 'purple');

    cloned.metadata.version = this.bumpVersion(cloned.metadata.version);
    cloned.metadata.updatedAt = new Date().toISOString();

    // Re-validate
    const validation = Validator.validateGame(cloned);
    if (!validation.valid) {
      return Validator.autoFix(cloned);
    }

    return cloned;
  },

  applyColorTheme(game, color) {
    const colors = {
      red:    { player: 0xef4444, enemy: 0xfbbf24, bg: '#1a0a0a' },
      blue:   { player: 0x3b82f6, enemy: 0xff6b35, bg: '#0a0a23' },
      green:  { player: 0x10b981, enemy: 0xa855f7, bg: '#0a1a0a' },
      purple: { player: 0xa855f7, enemy: 0x10b981, bg: '#1a0a2e' }
    };
    const c = colors[color];
    if (game.player) game.player.color = c.player;
    if (game.enemies) game.enemies.color = c.enemy;
    if (game.gameConfig) game.gameConfig.backgroundColor = c.bg;
  },

  bumpVersion(version) {
    const parts = (version || '1.0').split('.');
    parts[1] = (parseInt(parts[1] || 0) + 1).toString();
    return parts.join('.');
  },

  /**
   * Build 2D game JSON
   */
  build2DGame(prompt, answers, gameType) {
    const difficulty = answers.difficulty || 'medium';
    const theme = answers.theme || 'fantasy';

    // Difficulty maps
    const diffMap = {
      easy:   { lives: 5, enemySpeed: 80,  spawnRate: 2500, enemyCount: 2 },
      medium: { lives: 3, enemySpeed: 120, spawnRate: 1500, enemyCount: 4 },
      hard:   { lives: 2, enemySpeed: 180, spawnRate: 900,  enemyCount: 6 }
    };
    const d = diffMap[difficulty];

    // Theme colors
    const themeColors = {
      fantasy: { player: 0xa855f7, enemy: 0xef4444, bg: '#1a0a2e', collectible: 0xfbbf24 },
      forest:  { player: 0x10b981, enemy: 0x92400e, bg: '#0a1a0a', collectible: 0xfbbf24 },
      retro:   { player: 0xff6b35, enemy: 0xef4444, bg: '#0a0a0a', collectible: 0xffd700 },
      space:   { player: 0x00ffff, enemy: 0xff0066, bg: '#000033', collectible: 0xffff00 },
      scifi:   { player: 0x00ffff, enemy: 0xff00ff, bg: '#0a0a23', collectible: 0xffd700 },
      cyber:   { player: 0xec4899, enemy: 0x6366f1, bg: '#0d0521', collectible: 0xfbbf24 },
      desert:  { player: 0xfb923c, enemy: 0x991b1b, bg: '#1a1106', collectible: 0xfbbf24 },
      arcade:  { player: 0x3b82f6, enemy: 0xef4444, bg: '#000022', collectible: 0xfbbf24 },
      neon:    { player: 0x00ffaa, enemy: 0xff0066, bg: '#0d1117', collectible: 0xffd700 },
      dungeon: { player: 0xfbbf24, enemy: 0xef4444, bg: '#1a0a1a', collectible: 0xfbbf24 },
      pixel:   { player: 0xfbbf24, enemy: 0xef4444, bg: '#1a1a3e', collectible: 0xfbbf24 }
    };
    const tc = themeColors[theme] || themeColors.fantasy;

    const title = this.generateTitle(prompt, gameType);

    const base = {
      metadata: {
        gameTitle: title,
        description: this.generateDescription(prompt, gameType),
        genre: gameType,
        engine: 'phaser',
        dimension: '2D',
        difficulty,
        estimatedPlaytime: difficulty === 'easy' ? '5 minutes' : difficulty === 'hard' ? '15 minutes' : '8 minutes',
        version: '1.0',
        createdAt: new Date().toISOString()
      },
      gameConfig: {
        width: 800,
        height: gameType === 'runner' ? 400 : (gameType === 'platformer' ? 500 : 600),
        backgroundColor: tc.bg,
        physics: {
          system: 'arcade',
          gravity: (gameType === 'shooter' || gameType === 'rpg' || gameType === 'breakout') ? 0 : (gameType === 'runner' ? 1500 : 800),
          debug: false
        }
      },
      player: {
        color: tc.player,
        speed: this.getPlayerSpeed(gameType, answers),
        jumpVelocity: -500,
        lives: parseInt(answers.lives) || d.lives,
        size: { width: 32, height: 48 }
      },
      enemies: {
        color: tc.enemy,
        count: this.getEnemyCount(answers, d),
        spawnRate: this.getSpawnRate(answers, d),
        speed: d.enemySpeed,
        behavior: gameType === 'shooter' ? 'spawn-from-top' : gameType === 'rpg' ? 'patrol' : 'patrol'
      },
      collectibles: {
        color: tc.collectible,
        count: answers.treasureAmount === 'few' ? 4 : answers.treasureAmount === 'many' ? 12 : 10,
        value: 10,
        type: answers.collectibles || 'coin'
      },
      level: {
        platforms: this.generatePlatforms(),
        obstacles: [],
        walls: [],
        theme
      },
      ui: {
        showScore: true,
        showLives: true,
        showTimer: gameType === 'runner',
        showMinimap: false,
        fontFamily: 'Arial Black',
        primaryColor: '#a855f7',
        secondaryColor: '#3b82f6'
      },
      controls: {
        scheme: answers.controls || 'both',
        actionKey: 'space'
      },
      audio: {
        musicEnabled: false,
        sfxEnabled: true,
        theme: '8bit'
      }
    };

    // Genre-specific tweaks
    if (gameType === 'breakout') {
      base.level.brickRows = parseInt(answers.brickRows) || 5;
      base.level.brickCols = 10;
      base.level.ballSpeed = answers.ballSpeed === 'fast' ? 450 : answers.ballSpeed === 'slow' ? 250 : 350;
    }

    if (gameType === 'runner') {
      base.player.jumpVelocity = -650;
      base.gameConfig.gameSpeed = answers.speed === 'fast' ? 600 : answers.speed === 'slow' ? 300 : 450;
    }

    return base;
  },

  /**
   * Build 3D game JSON
   */
  build3DGame(prompt, answers, gameType) {
    const difficulty = answers.difficulty || 'medium';
    const env = answers.environment || 'forest';
    const mood = answers.mood || 'bright';

    const envColors = {
      forest:      { bg: '#0a1f0a', ground: 0x4ade80, ambient: '#404060' },
      space:       { bg: '#000033', ground: 0x4a4a6e, ambient: '#202040' },
      underground: { bg: '#0a0a0a', ground: 0x3a3a3a, ambient: '#1a1a1a' }
    };
    const e = envColors[env] || envColors.forest;

    return {
      metadata: {
        gameTitle: this.generateTitle(prompt, gameType),
        description: this.generateDescription(prompt, gameType),
        genre: 'explorer-fp',
        engine: 'threejs',
        dimension: '3D',
        difficulty,
        estimatedPlaytime: '5-10 minutes',
        version: '1.0',
        createdAt: new Date().toISOString()
      },
      scene: {
        backgroundColor: e.bg,
        fog: { enabled: true, color: e.bg, near: 10, far: 100 },
        skybox: env === 'space' ? 'stars' : 'sky'
      },
      camera: {
        type: 'first-person',
        fov: 75,
        near: 0.1,
        far: 500,
        initialPosition: { x: 0, y: 1.6, z: 0 }
      },
      lighting: {
        ambient: { color: e.ambient, intensity: mood === 'horror' ? 0.2 : mood === 'moody' ? 0.4 : 0.6 },
        directional: {
          color: '#ffffff',
          intensity: mood === 'horror' ? 0.5 : 1.2,
          position: { x: 10, y: 20, z: 10 },
          castShadow: true
        },
        mood
      },
      player: {
        model: 'capsule',
        color: 0xa855f7,
        size: { width: 1, height: 2, depth: 1 },
        moveSpeed: 8,
        jumpForce: 10,
        lives: difficulty === 'easy' ? 5 : difficulty === 'hard' ? 2 : 3
      },
      physics: {
        gravity: { x: 0, y: -9.81, z: 0 },
        playerCollider: 'capsule'
      },
      world: {
        ground: { type: 'plane', size: 100, color: e.ground, texture: env === 'forest' ? 'grass' : 'stone' },
        obstacles: this.generate3DObstacles(),
        collectibles: this.generate3DCollectibles()
      },
      enemies: {
        model: 'box',
        color: 0xef4444,
        count: difficulty === 'easy' ? 2 : difficulty === 'hard' ? 8 : 5,
        spawnPositions: [
          {x: 10, y: 1, z: 10}, {x: -10, y: 1, z: 10}, {x: 0, y: 1, z: -10},
          {x: 15, y: 1, z: -5}, {x: -15, y: 1, z: 5}
        ],
        moveSpeed: 3,
        behavior: 'chase'
      },
      ui: {
        showCrosshair: true,
        showHUD: true,
        showCompass: false,
        showFPS: false
      },
      controls: {
        scheme: 'fps',
        mouseLook: true,
        actionKey: 'e'
      }
    };
  },

  // Helpers
  generateTitle(prompt, gameType) {
    const titles = {
      platformer: ['Crystal Quest', 'Sky Jumpers', 'Pixel Adventure', 'Hero\'s Path', 'Dragon Run'],
      shooter:    ['Star Defender', 'Galaxy Wars', 'Cosmic Strike', 'Space Rangers', 'Void Hunter'],
      runner:     ['Endless Dash', 'Sprint Forever', 'Velocity', 'Rush Hour', 'Speed Demon'],
      breakout:   ['Brick Smasher', 'Ball Crusher', 'Wall Breaker', 'Bounce Master'],
      rpg:        ['Dungeon Quest', 'Treasure Hunter', 'Maze of Legends', 'Crypt Explorer'],
      'explorer-fp': ['Lost Worlds', 'The Mystery', 'Hidden Realms', 'Echo Caves']
    };
    const list = titles[gameType] || titles.platformer;
    return list[Math.floor(Math.random() * list.length)];
  },

  generateDescription(prompt, gameType) {
    const descriptions = {
      platformer: '׳׳©׳—׳§ ׳₪׳׳˜׳₪׳•׳¨׳׳¨ ׳׳¨׳’׳© ׳¢׳ ׳§׳₪׳™׳¦׳•׳×, ׳׳¡׳₪׳ ׳•׳× ׳•׳׳•׳™׳‘׳™׳ ׳׳¡׳•׳›׳ ׳™׳',
      shooter: '׳׳©׳—׳§ ׳—׳׳ ׳©׳‘׳• ׳׳×׳” ׳׳•׳—׳ ׳׳•׳ ׳’׳׳™ ׳׳•׳™׳‘׳™׳',
      runner: '׳¨׳•׳¥ ׳‘׳׳”׳™׳¨׳•׳×, ׳§׳₪׳•׳¥ ׳׳¢׳ ׳׳›׳©׳•׳׳™׳ ׳•׳”׳’׳¢ ׳¨׳—׳•׳§ ׳›׳›׳ ׳©׳ ׳™׳×׳',
      breakout: '׳©׳‘׳•׳¨ ׳׳× ׳›׳ ׳”׳׳‘׳ ׳™׳ ׳¢׳ ׳”׳›׳“׳•׳¨ ׳•׳”׳׳—׳‘׳˜ ׳©׳׳',
      rpg: '׳—׳§׳•׳¨ ׳׳‘׳•׳ ׳׳¡׳•׳›׳, ׳׳¡׳•׳£ ׳׳•׳¦׳¨׳•׳× ׳•׳”׳™׳׳ ׳¢ ׳׳׳₪׳׳¦׳•׳×',
      'explorer-fp': '׳—׳§׳•׳¨ ׳¢׳•׳׳ ׳×׳׳×-׳׳׳“׳™ ׳‘׳’׳•׳£ ׳¨׳׳©׳•׳'
    };
    return descriptions[gameType] || descriptions.platformer;
  },

  getPlayerSpeed(gameType, answers) {
    if (gameType === 'runner') return 0; // Auto-runner
    if (gameType === 'breakout') return 500;
    if (answers.jumpStyle === 'snappy') return 280;
    if (answers.jumpStyle === 'realistic') return 180;
    return 200;
  },

  getEnemyCount(answers, d) {
    if (answers.enemyCount === 'few') return 2;
    if (answers.enemyCount === 'many') return 6;
    return d.enemyCount;
  },

  getSpawnRate(answers, d) {
    if (answers.enemySpawnRate === 'slow') return 3000;
    if (answers.enemySpawnRate === 'intense') return 800;
    if (answers.enemySpawnRate === 'normal') return 1500;
    return d.spawnRate;
  },

  generatePlatforms() {
    return [
      { x: 150, y: 380, width: 150 },
      { x: 450, y: 320, width: 200 },
      { x: 700, y: 250, width: 150 },
      { x: 200, y: 180, width: 150 },
      { x: 550, y: 130, width: 120 }
    ];
  },

  generate3DObstacles() {
    const obstacles = [];
    const positions = [
      [5, 1, 5], [-5, 1, 5], [10, 1, -5], [-10, 1, -5],
      [0, 1, 15], [15, 2, 0], [-15, 2, 0], [8, 1, -10]
    ];
    positions.forEach(([x, y, z]) => {
      obstacles.push({
        type: 'box',
        position: { x, y, z },
        size: { width: 2, height: 2, depth: 2 },
        color: 0x6b46c1,
        isStatic: true
      });
    });
    return obstacles;
  },

  generate3DCollectibles() {
    const items = [];
    const positions = [
      [3, 1, 8], [-7, 1, 12], [12, 1, -3], [-12, 1, 8], [5, 1, -15]
    ];
    positions.forEach(([x, y, z]) => {
      items.push({
        type: 'crystal',
        position: { x, y, z },
        color: 0x00ffff,
        value: 50
      });
    });
    return items;
  },

  getFallbackGame(gameType, dimension) {
    if (dimension === '3D') {
      return this.build3DGame('explore', { difficulty: 'medium' }, 'explorer-fp');
    }
    return this.build2DGame('adventure', { difficulty: 'medium', theme: 'fantasy' }, 'platformer');
  },

  // Simulate AI thinking time
  simulateThinking(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  async postJSON(endpoint, body) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.details || payload.error || 'Backend request failed');
    }

    return payload;
  },

  isValidMCQPayload(payload) {
    if (!payload || !Array.isArray(payload.questions)) return false;
    if (!payload.gameType || !payload.dimension) return false;
    if (payload.questions.length !== 5) return false;
    return payload.questions.every(q =>
      q &&
      typeof q.id === 'string' &&
      typeof q.question === 'string' &&
      Array.isArray(q.options) &&
      q.options.length >= 2 &&
      q.options.length <= 5 &&
      q.options.every(o => o && typeof o.label === 'string' && typeof o.value === 'string')
    );
  }
};

window.MockAI = MockAI;

