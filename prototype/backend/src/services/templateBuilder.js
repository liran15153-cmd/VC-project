/* ============================================================================
   Template Builder
   ----------------------------------------------------------------------------
   Converts validated game JSON into playable browser HTML.
   ========================================================================= */

function escapeHTML(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function serializeForScript(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function buildGameHTML(gameJSON) {
  const dimension = gameJSON?.metadata?.dimension;
  if (dimension === '3D') return buildThreeHTML(gameJSON);
  return buildPhaserHTML(gameJSON);
}

function buildBase({ title, description, body, scripts }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self' https://cdn.jsdelivr.net https://unpkg.com; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co http://127.0.0.1:54321 http://localhost:54321; media-src 'self' data: blob: https://*.supabase.co http://127.0.0.1:54321 http://localhost:54321; connect-src 'self' https://*.supabase.co http://127.0.0.1:54321 http://localhost:54321;">
  <title>${escapeHTML(title)}</title>
  <style>
    html, body { margin: 0; width: 100%; height: 100%; background: #0f172a; overflow: hidden; font-family: Arial, sans-serif; }
    #game, canvas { width: 100%; height: 100%; display: block; }
    .hud { position: fixed; left: 16px; top: 14px; z-index: 10; color: white; font: 600 14px Arial, sans-serif; text-shadow: 0 1px 3px rgba(0,0,0,.8); }
    .hint { position: fixed; right: 16px; bottom: 14px; z-index: 10; color: rgba(255,255,255,.76); font: 13px Arial, sans-serif; }
  </style>
</head>
<body>
  <div class="hud" id="hud">${escapeHTML(description)}</div>
  <div id="game"></div>
  <div class="hint">Arrows/WASD to move</div>
${body}
${scripts}
</body>
</html>`;
}

function buildPhaserHTML(gameJSON) {
  const title = gameJSON.metadata.gameTitle;
  const data = serializeForScript(gameJSON);
  const scripts = `
  <script src="https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js"></script>
  <script>
  const gameData = ${data};
  const cfg = gameData.gameConfig || {};
  const playerCfg = gameData.player || {};
  const enemyCfg = gameData.enemies || {};
  const collectibleCfg = gameData.collectibles || {};
  const levelCfg = gameData.level || {};
  let player, cursors, keys, score = 0, lives = playerCfg.lives || 3, scoreText, livesText;

  class MainScene extends Phaser.Scene {
    constructor() { super('MainScene'); }
    create() {
      this.cameras.main.setBackgroundColor(cfg.backgroundColor || '#111827');
      const width = cfg.width || 800;
      const height = cfg.height || 600;
      const platforms = this.physics.add.staticGroup();
      const platformData = levelCfg.platforms?.length ? levelCfg.platforms : [{ x: width / 2, y: height - 24, width: width - 64 }];
      platformData.forEach((p) => {
        const platform = this.add.rectangle(p.x, p.y, p.width, 24, 0x334155);
        platforms.add(platform);
      });

      const size = playerCfg.size || { width: 32, height: 48 };
      player = this.add.rectangle(80, height - 120, size.width, size.height, playerCfg.color || 0x38bdf8);
      this.physics.add.existing(player);
      player.body.setCollideWorldBounds(true);
      this.physics.add.collider(player, platforms);

      const collectibles = this.physics.add.group();
      const collectibleCount = collectibleCfg.count ?? 8;
      for (let i = 0; i < collectibleCount; i++) {
        const item = this.add.circle(140 + i * 70 % Math.max(200, width - 160), 120 + (i % 3) * 90, 10, collectibleCfg.color || 0xfacc15);
        this.physics.add.existing(item);
        item.body.setAllowGravity(false);
        collectibles.add(item);
      }
      this.physics.add.overlap(player, collectibles, (_p, item) => {
        item.destroy();
        score += collectibleCfg.value || 10;
        scoreText.setText('Score: ' + score);
      });

      const enemies = this.physics.add.group();
      const enemyCount = enemyCfg.count ?? 3;
      for (let i = 0; i < enemyCount; i++) {
        const enemy = this.add.rectangle(width - 120 - i * 80, height - 90, 30, 30, enemyCfg.color || 0xef4444);
        this.physics.add.existing(enemy);
        enemy.body.setVelocityX((i % 2 ? -1 : 1) * (enemyCfg.speed || 80));
        enemy.body.setCollideWorldBounds(true);
        enemy.body.setBounce(1, 0);
        enemies.add(enemy);
      }
      this.physics.add.collider(enemies, platforms);
      this.physics.add.collider(player, enemies, () => {
        lives -= 1;
        livesText.setText('Lives: ' + lives);
        player.x = 80;
        player.y = height - 120;
        if (lives <= 0) this.scene.restart();
      });

      cursors = this.input.keyboard.createCursorKeys();
      keys = this.input.keyboard.addKeys('W,A,S,D,SPACE');
      scoreText = this.add.text(16, 16, 'Score: 0', { font: '18px Arial', fill: '#ffffff' }).setScrollFactor(0);
      livesText = this.add.text(16, 40, 'Lives: ' + lives, { font: '18px Arial', fill: '#ffffff' }).setScrollFactor(0);
    }
    update() {
      const speed = playerCfg.speed || 260;
      const jump = playerCfg.jumpVelocity || -520;
      const left = cursors.left.isDown || keys.A.isDown;
      const right = cursors.right.isDown || keys.D.isDown;
      player.body.setVelocityX(left ? -speed : right ? speed : 0);
      if ((cursors.up.isDown || keys.W.isDown || keys.SPACE.isDown) && player.body.blocked.down) {
        player.body.setVelocityY(jump);
      }
    }
  }

  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: cfg.width || 800,
    height: cfg.height || 600,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { gravity: { y: cfg.physics?.gravity ?? 800 }, debug: !!cfg.physics?.debug } },
    scene: MainScene
  });
  </script>`;

  return buildBase({
    title,
    description: `${gameJSON.metadata.genre} | ${gameJSON.metadata.difficulty || 'medium'}`,
    body: '',
    scripts
  });
}

function buildThreeHTML(gameJSON) {
  const title = gameJSON.metadata.gameTitle;
  const data = serializeForScript(gameJSON);
  const scripts = `
  <script type="module">
  import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';
  const gameData = ${data};
  const sceneCfg = gameData.scene || {};
  const playerCfg = gameData.player || {};
  const worldCfg = gameData.world || {};
  const cameraCfg = gameData.camera || {};
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(sceneCfg.backgroundColor || '#111827');
  if (sceneCfg.fog?.enabled) scene.fog = new THREE.Fog(sceneCfg.fog.color, sceneCfg.fog.near, sceneCfg.fog.far);

  const camera = new THREE.PerspectiveCamera(cameraCfg.fov || 75, window.innerWidth / window.innerHeight, cameraCfg.near || 0.1, cameraCfg.far || 500);
  const initial = cameraCfg.initialPosition || { x: 0, y: 6, z: 12 };
  camera.position.set(initial.x, initial.y, initial.z);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.getElementById('game').appendChild(renderer.domElement);

  const ambient = gameData.lighting?.ambient || { color: '#ffffff', intensity: 0.6 };
  scene.add(new THREE.AmbientLight(ambient.color, ambient.intensity));
  const directionalCfg = gameData.lighting?.directional || { color: '#ffffff', intensity: 1, position: { x: 5, y: 10, z: 5 } };
  const sun = new THREE.DirectionalLight(directionalCfg.color, directionalCfg.intensity);
  sun.position.set(directionalCfg.position.x, directionalCfg.position.y, directionalCfg.position.z);
  sun.castShadow = true;
  scene.add(sun);

  const groundSize = worldCfg.ground?.size || 80;
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(groundSize, 0.35, groundSize),
    new THREE.MeshStandardMaterial({ color: worldCfg.ground?.color || 0x334155 })
  );
  ground.position.y = -0.2;
  ground.receiveShadow = true;
  scene.add(ground);

  const playerSize = playerCfg.size || { width: 1, height: 2, depth: 1 };
  const player = new THREE.Mesh(
    new THREE.BoxGeometry(playerSize.width, playerSize.height, playerSize.depth),
    new THREE.MeshStandardMaterial({ color: playerCfg.color || 0x38bdf8 })
  );
  player.position.y = playerSize.height / 2;
  player.castShadow = true;
  scene.add(player);

  const collectibles = [];
  (worldCfg.collectibles || []).forEach((c) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.35, 24, 16), new THREE.MeshStandardMaterial({ color: c.color || 0xfacc15 }));
    mesh.position.set(c.position.x, c.position.y, c.position.z);
    scene.add(mesh);
    collectibles.push(mesh);
  });
  if (collectibles.length === 0) {
    for (let i = 0; i < 8; i++) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.35, 24, 16), new THREE.MeshStandardMaterial({ color: 0xfacc15 }));
      mesh.position.set(Math.cos(i) * 8, 0.5, Math.sin(i) * 8);
      scene.add(mesh);
      collectibles.push(mesh);
    }
  }

  (worldCfg.obstacles || []).forEach((o) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(o.size.width, o.size.height, o.size.depth),
      new THREE.MeshStandardMaterial({ color: o.color || 0x64748b })
    );
    mesh.position.set(o.position.x, o.position.y, o.position.z);
    mesh.castShadow = true;
    scene.add(mesh);
  });

  const keys = new Set();
  window.addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()));
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  let score = 0;
  const hud = document.getElementById('hud');
  function animate() {
    requestAnimationFrame(animate);
    const speed = (playerCfg.moveSpeed || 8) * 0.025;
    if (keys.has('arrowleft') || keys.has('a')) player.position.x -= speed;
    if (keys.has('arrowright') || keys.has('d')) player.position.x += speed;
    if (keys.has('arrowup') || keys.has('w')) player.position.z -= speed;
    if (keys.has('arrowdown') || keys.has('s')) player.position.z += speed;
    camera.position.x += (player.position.x - camera.position.x) * 0.06;
    camera.position.z += (player.position.z + 10 - camera.position.z) * 0.06;
    camera.lookAt(player.position);
    collectibles.forEach((item) => {
      item.rotation.y += 0.03;
      if (item.visible && item.position.distanceTo(player.position) < 1.4) {
        item.visible = false;
        score += 10;
        hud.textContent = 'Score: ' + score;
      }
    });
    renderer.render(scene, camera);
  }
  animate();
  </script>`;

  return buildBase({
    title,
    description: `${gameJSON.metadata.genre} | ${gameJSON.metadata.difficulty || 'medium'}`,
    body: '',
    scripts
  });
}

module.exports = { buildGameHTML, serializeForScript };
