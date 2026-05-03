/* ============================================================================
   Template Builder
   ============================================================================
   Converts validated game JSON into runnable HTML.
   Routes to the appropriate template based on metadata.genre.
   ========================================================================= */

const TemplateBuilder = {

  /**
   * Build playable HTML from game JSON
   * @param {object} gameJSON - Validated game configuration
   * @returns {string} - Complete HTML string ready for iframe srcdoc
   */
  build(gameJSON) {
    if (!gameJSON || !gameJSON.metadata) {
      throw new Error('Invalid game JSON: missing metadata');
    }

    const genre = gameJSON.metadata.genre;
    const dimension = gameJSON.metadata.dimension;

    // Pick the right template
    const template = GameTemplates[genre];
    if (!template) {
      console.warn('No template for genre:', genre, '— falling back to platformer');
      return GameTemplates.platformer(this.applyDefaults(gameJSON));
    }

    // Apply defaults to ensure all needed fields exist
    const safeJSON = this.applyDefaults(gameJSON);

    return template(safeJSON);
  },

  /**
   * Ensure JSON has all fields the template expects
   */
  applyDefaults(g) {
    const safe = JSON.parse(JSON.stringify(g));

    // Default metadata
    safe.metadata = safe.metadata || {};

    // 2D defaults
    if (safe.metadata.dimension === '2D' || !safe.metadata.dimension) {
      safe.gameConfig = safe.gameConfig || {};
      safe.gameConfig.width = safe.gameConfig.width || 800;
      safe.gameConfig.height = safe.gameConfig.height || 600;
      safe.gameConfig.backgroundColor = safe.gameConfig.backgroundColor || '#1a1a2e';
      safe.gameConfig.physics = safe.gameConfig.physics || { system: 'arcade', gravity: 800, debug: false };

      safe.player = safe.player || {};
      safe.player.color = safe.player.color || 0xa855f7;
      safe.player.speed = safe.player.speed || 200;
      safe.player.jumpVelocity = safe.player.jumpVelocity || -500;
      safe.player.lives = safe.player.lives || 3;
      safe.player.size = safe.player.size || { width: 32, height: 48 };

      safe.enemies = safe.enemies || {};
      safe.enemies.color = safe.enemies.color || 0xef4444;
      safe.enemies.count = safe.enemies.count != null ? safe.enemies.count : 3;
      safe.enemies.spawnRate = safe.enemies.spawnRate || 1500;
      safe.enemies.speed = safe.enemies.speed || 100;

      safe.collectibles = safe.collectibles || {};
      safe.collectibles.color = safe.collectibles.color || 0xfbbf24;
      safe.collectibles.count = safe.collectibles.count || 10;
      safe.collectibles.value = safe.collectibles.value || 10;

      safe.level = safe.level || {};
      safe.level.platforms = safe.level.platforms || [];
      safe.level.walls = safe.level.walls || [];
    }

    // 3D defaults
    if (safe.metadata.dimension === '3D') {
      safe.scene = safe.scene || {};
      safe.scene.backgroundColor = safe.scene.backgroundColor || '#0a0a23';
      safe.scene.fog = safe.scene.fog || { enabled: true, color: '#0a0a23', near: 10, far: 100 };

      safe.camera = safe.camera || {};
      safe.camera.fov = safe.camera.fov || 75;
      safe.camera.near = safe.camera.near || 0.1;
      safe.camera.far = safe.camera.far || 500;
      safe.camera.initialPosition = safe.camera.initialPosition || { x: 0, y: 1.6, z: 0 };

      safe.lighting = safe.lighting || {};
      safe.lighting.ambient = safe.lighting.ambient || { color: '#404060', intensity: 0.5 };
      safe.lighting.directional = safe.lighting.directional || { color: '#ffffff', intensity: 1, position: { x: 10, y: 20, z: 10 }, castShadow: true };

      safe.player = safe.player || {};
      safe.player.moveSpeed = safe.player.moveSpeed || 8;
      safe.player.jumpForce = safe.player.jumpForce || 10;
      safe.player.lives = safe.player.lives || 3;

      safe.physics = safe.physics || {};
      safe.physics.gravity = safe.physics.gravity || { x: 0, y: -9.81, z: 0 };

      safe.world = safe.world || {};
      safe.world.ground = safe.world.ground || { type: 'plane', size: 100, color: 0x4ade80, texture: 'grass' };
      safe.world.obstacles = safe.world.obstacles || [];
      safe.world.collectibles = safe.world.collectibles || [];

      safe.enemies = safe.enemies || {};
      safe.enemies.count = safe.enemies.count != null ? safe.enemies.count : 3;
      safe.enemies.color = safe.enemies.color || 0xef4444;
      safe.enemies.moveSpeed = safe.enemies.moveSpeed || 3;
      safe.enemies.spawnPositions = safe.enemies.spawnPositions || [{x:5,y:1,z:5},{x:-5,y:1,z:5},{x:0,y:1,z:-5}];
    }

    return safe;
  },

  /**
   * Build a downloadable Blob from the HTML
   */
  buildBlob(gameJSON) {
    const html = this.build(gameJSON);
    return new Blob([html], { type: 'text/html' });
  },

  /**
   * Trigger download of the game as standalone HTML
   */
  download(gameJSON) {
    const blob = this.buildBlob(gameJSON);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (gameJSON.metadata.gameTitle || 'game').replace(/[^a-z0-9]/gi, '_') + '.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};

window.TemplateBuilder = TemplateBuilder;
