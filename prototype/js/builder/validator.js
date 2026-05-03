/* ============================================================================
   Game JSON Validator
   ============================================================================
   Implements the validation loop that runs on every AI-generated game JSON.
   Mirrors the validation rules in the system prompts.
   ========================================================================= */

const Validator = {

  /**
   * Master validation entry point
   * @returns {valid: boolean, errors: Array<string>, warnings: Array<string>}
   */
  validateGame(game) {
    const errors = [];
    const warnings = [];

    // Step 1: Structural validation
    this.validateStructure(game, errors);
    if (errors.length > 0) return { valid: false, errors, warnings };

    // Step 2: Type validation
    this.validateTypes(game, errors);

    // Step 3: Range validation
    this.validateRanges(game, errors, warnings);

    // Step 4: Semantic validation
    this.validateSemantics(game, errors, warnings);

    // Step 5: Playability validation
    this.validatePlayability(game, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  },

  validateStructure(game, errors) {
    if (!game) {
      errors.push('Game is null or undefined');
      return;
    }

    const requiredKeys = ['metadata', 'player', 'controls'];
    requiredKeys.forEach(key => {
      if (!(key in game)) errors.push(`Missing required key: ${key}`);
    });

    if (game.metadata) {
      const requiredMeta = ['gameTitle', 'genre', 'engine', 'dimension'];
      requiredMeta.forEach(key => {
        if (!(key in game.metadata)) errors.push(`Missing metadata.${key}`);
      });

      const validGenres2D = ['platformer', 'shooter', 'runner', 'breakout', 'rpg', 'puzzle'];
      const validGenres3D = ['explorer-fp', 'adventure-tp', 'platformer-3d', 'runner-3d', 'racing', 'flying'];

      if (game.metadata.dimension === '2D' && !validGenres2D.includes(game.metadata.genre)) {
        errors.push(`Invalid 2D genre: ${game.metadata.genre}`);
      }
      if (game.metadata.dimension === '3D' && !validGenres3D.includes(game.metadata.genre)) {
        errors.push(`Invalid 3D genre: ${game.metadata.genre}`);
      }

      if (game.metadata.dimension === '2D' && game.metadata.engine !== 'phaser') {
        errors.push(`2D games must use phaser engine, got: ${game.metadata.engine}`);
      }
      if (game.metadata.dimension === '3D' && game.metadata.engine !== 'threejs') {
        errors.push(`3D games must use threejs engine, got: ${game.metadata.engine}`);
      }
    }
  },

  validateTypes(game, errors) {
    if (game.player) {
      if (typeof game.player.color !== 'number') {
        errors.push('player.color must be a number (hex like 0xa855f7)');
      }
      if (typeof game.player.lives !== 'number') {
        errors.push('player.lives must be a number');
      }
    }

    if (game.enemies && typeof game.enemies.color !== 'number') {
      errors.push('enemies.color must be a number');
    }

    if (game.gameConfig && typeof game.gameConfig.backgroundColor !== 'string') {
      errors.push('gameConfig.backgroundColor must be a string with #');
    }
  },

  validateRanges(game, errors, warnings) {
    if (game.player) {
      if (game.player.speed != null && (game.player.speed < 0 || game.player.speed > 700)) {
        warnings.push(`player.speed (${game.player.speed}) outside recommended range 0-700`);
      }
      if (game.player.lives != null && (game.player.lives < 1 || game.player.lives > 10)) {
        errors.push(`player.lives (${game.player.lives}) must be 1-10`);
      }
    }

    if (game.gameConfig && game.gameConfig.physics) {
      const g = game.gameConfig.physics.gravity;
      if (g != null && (g < 0 || g > 3000)) {
        warnings.push(`gravity (${g}) outside recommended range 0-3000`);
      }
    }

    if (game.enemies) {
      if (game.enemies.spawnRate != null && (game.enemies.spawnRate < 100 || game.enemies.spawnRate > 10000)) {
        warnings.push(`enemies.spawnRate (${game.enemies.spawnRate}) outside recommended range 100-10000`);
      }
      if (game.enemies.count != null && (game.enemies.count < 0 || game.enemies.count > 30)) {
        warnings.push(`enemies.count (${game.enemies.count}) outside recommended range 0-30`);
      }
    }

    if (game.collectibles && game.collectibles.count != null) {
      if (game.collectibles.count < 0 || game.collectibles.count > 50) {
        warnings.push(`collectibles.count (${game.collectibles.count}) outside recommended range 0-50`);
      }
    }
  },

  validateSemantics(game, errors, warnings) {
    if (!game.metadata) return;
    const genre = game.metadata.genre;

    // 2D genre semantics
    if (game.metadata.dimension === '2D') {
      if (genre === 'platformer') {
        if (game.gameConfig && game.gameConfig.physics && game.gameConfig.physics.gravity === 0) {
          warnings.push('Platformer should have gravity > 0');
        }
        if (game.level && game.level.platforms && game.level.platforms.length < 2) {
          warnings.push('Platformer should have at least 2 platforms');
        }
      }

      if (genre === 'shooter' || genre === 'rpg' || genre === 'breakout') {
        if (game.gameConfig && game.gameConfig.physics && game.gameConfig.physics.gravity > 0) {
          warnings.push(`${genre} typically has gravity = 0`);
        }
      }

      if (genre === 'runner') {
        if (game.gameConfig && game.gameConfig.physics && game.gameConfig.physics.gravity < 500) {
          warnings.push('Runner should have strong gravity');
        }
      }
    }

    // 3D semantics
    if (game.metadata.dimension === '3D') {
      if (game.camera && game.controls) {
        const validPairs = {
          'first-person': 'fps',
          'third-person': 'third-person'
        };
        const expected = validPairs[game.camera.type];
        if (expected && game.controls.scheme !== expected) {
          warnings.push(`Camera type "${game.camera.type}" usually pairs with "${expected}" controls`);
        }
      }

      if (game.physics && game.physics.gravity && game.physics.gravity.y >= 0) {
        warnings.push('3D gravity.y should be negative for downward force');
      }

      if (!game.lighting || (!game.lighting.ambient && !game.lighting.directional)) {
        errors.push('3D scene needs lighting (ambient or directional)');
      }
    }

    // Color distinctiveness
    if (game.player && game.enemies) {
      if (game.player.color === game.enemies.color) {
        warnings.push('Player and enemy colors are the same — visually confusing');
      }
    }
  },

  validatePlayability(game, warnings) {
    // Has objective
    const hasObjective = (
      (game.collectibles && game.collectibles.count > 0) ||
      (game.enemies && game.enemies.count > 0)
    );
    if (!hasObjective) {
      warnings.push('Game has no clear objective (no enemies or collectibles)');
    }

    // Lives reasonable
    if (game.player && game.player.lives === 0) {
      warnings.push('Player starts with 0 lives — unwinnable');
    }
  },

  /**
   * Auto-fix common issues
   */
  autoFix(game) {
    if (!game) return null;
    const fixed = JSON.parse(JSON.stringify(game));

    // Ensure metadata
    if (!fixed.metadata) {
      fixed.metadata = {};
    }
    if (!fixed.metadata.gameTitle) fixed.metadata.gameTitle = 'My Game';
    if (!fixed.metadata.genre) fixed.metadata.genre = 'platformer';
    if (!fixed.metadata.engine) fixed.metadata.engine = fixed.metadata.dimension === '3D' ? 'threejs' : 'phaser';
    if (!fixed.metadata.dimension) fixed.metadata.dimension = '2D';
    if (!fixed.metadata.difficulty) fixed.metadata.difficulty = 'medium';
    if (!fixed.metadata.version) fixed.metadata.version = '1.0';
    if (!fixed.metadata.createdAt) fixed.metadata.createdAt = new Date().toISOString();

    // Convert string colors to numbers
    if (fixed.player && typeof fixed.player.color === 'string') {
      fixed.player.color = this.hexStringToNumber(fixed.player.color);
    }
    if (fixed.enemies && typeof fixed.enemies.color === 'string') {
      fixed.enemies.color = this.hexStringToNumber(fixed.enemies.color);
    }

    // Clamp lives
    if (fixed.player && (!fixed.player.lives || fixed.player.lives < 1)) {
      fixed.player.lives = 3;
    }
    if (fixed.player && fixed.player.lives > 10) {
      fixed.player.lives = 10;
    }

    return fixed;
  },

  hexStringToNumber(hex) {
    if (typeof hex !== 'string') return 0xa855f7;
    return parseInt(hex.replace('#', '0x'));
  }
};

window.Validator = Validator;
