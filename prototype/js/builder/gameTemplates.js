/* ============================================================================
   Game Templates
   ============================================================================
   Generates actual playable game HTML from JSON config.
   Each template is a function: (config) => HTML string

   Templates included:
     - 2D: platformer, shooter, runner, breakout, rpg
     - 3D: explorer-fp (Three.js)
   ========================================================================= */

const GameTemplates = {

  // ============= 2D PLATFORMER =============
  platformer(g) {
    const playerColor = g.player.color;
    const enemyColor = g.enemies.color;
    const collectibleColor = g.collectibles.color;
    const bgColor = g.gameConfig.backgroundColor;
    const gravity = g.gameConfig.physics.gravity;
    const playerSpeed = g.player.speed;
    const jumpVel = g.player.jumpVelocity;
    const lives = g.player.lives;
    const enemyCount = g.enemies.count;
    const enemySpeed = g.enemies.speed;
    const collectibleCount = g.collectibles.count;
    const title = g.metadata.gameTitle;
    const platforms = JSON.stringify(g.level.platforms);

    return this.htmlWrapper(title, bgColor, `
      const PLATFORMS = ${platforms};
      let player, cursors, wasd, platformGroup, coins, enemies, scoreText, livesText;
      let score = 0, lives = ${lives}, isGameOver = false;

      const config = {
        type: Phaser.AUTO,
        width: ${g.gameConfig.width},
        height: ${g.gameConfig.height},
        parent: 'game-container',
        physics: { default: 'arcade', arcade: { gravity: { y: ${gravity} }, debug: false }},
        scene: { preload, create, update }
      };
      const game = new Phaser.Game(config);

      function preload() {
        this.add.graphics().fillStyle(${playerColor}).fillRect(0, 0, 32, 48).generateTexture('player', 32, 48);
        this.add.graphics().fillStyle(0x6b46c1).fillRect(0, 0, 100, 20).generateTexture('ground', 100, 20);
        this.add.graphics().fillStyle(${enemyColor}).fillCircle(16, 16, 16).generateTexture('enemy', 32, 32);
        this.add.graphics().fillStyle(${collectibleColor}).fillCircle(8, 8, 8).generateTexture('coin', 16, 16);
      }

      function create() {
        // Background stars
        for (let i = 0; i < 60; i++) {
          this.add.circle(Phaser.Math.Between(0, ${g.gameConfig.width}), Phaser.Math.Between(0, ${g.gameConfig.height - 100}),
            1, 0xffffff, Phaser.Math.FloatBetween(0.3, 1));
        }

        platformGroup = this.physics.add.staticGroup();
        platformGroup.create(${g.gameConfig.width / 2}, ${g.gameConfig.height - 20}, 'ground').setScale(${g.gameConfig.width / 100}, 1).refreshBody();
        PLATFORMS.forEach(p => {
          platformGroup.create(p.x, p.y, 'ground').setScale(p.width / 100, 1).refreshBody();
        });

        player = this.physics.add.sprite(50, ${g.gameConfig.height - 100}, 'player');
        player.setCollideWorldBounds(true);
        player.setBounce(0.1);
        this.physics.add.collider(player, platformGroup);

        // Coins on platforms
        coins = this.physics.add.group();
        const coinSpots = [];
        PLATFORMS.forEach(p => coinSpots.push({x: p.x, y: p.y - 30}));
        coinSpots.push({x: 100, y: 100}, {x: 700, y: 100}, {x: 400, y: 50});
        coinSpots.slice(0, ${collectibleCount}).forEach(pos => {
          const coin = coins.create(pos.x, pos.y, 'coin');
          coin.body.setAllowGravity(false);
          this.tweens.add({ targets: coin, y: pos.y - 8, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        });
        this.physics.add.overlap(player, coins, collectCoin, null, this);

        // Enemies
        enemies = this.physics.add.group();
        for (let i = 0; i < ${enemyCount}; i++) {
          const enemy = enemies.create(150 + i * 150, 200, 'enemy');
          enemy.setBounce(1);
          enemy.setCollideWorldBounds(true);
          enemy.setVelocityX(Phaser.Math.Between(-${enemySpeed}, ${enemySpeed}));
        }
        this.physics.add.collider(enemies, platformGroup);
        this.physics.add.overlap(player, enemies, hitEnemy, null, this);

        // UI
        scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '22px', fontFamily: 'Arial Black', fill: '#fff', stroke: '#a855f7', strokeThickness: 4 });
        livesText = this.add.text(16, 46, '❤️ ' + lives, { fontSize: '22px', fontFamily: 'Arial Black', fill: '#ff5566' });

        cursors = this.input.keyboard.createCursorKeys();
        wasd = this.input.keyboard.addKeys('W,A,S,D');
      }

      function update() {
        if (isGameOver) return;
        const left = cursors.left.isDown || wasd.A.isDown;
        const right = cursors.right.isDown || wasd.D.isDown;
        const jump = cursors.up.isDown || cursors.space.isDown || wasd.W.isDown;

        if (left) { player.setVelocityX(-${playerSpeed}); player.setFlipX(true); }
        else if (right) { player.setVelocityX(${playerSpeed}); player.setFlipX(false); }
        else player.setVelocityX(0);

        if (jump && player.body.touching.down) player.setVelocityY(${jumpVel});

        if (player.y > ${g.gameConfig.height}) loseLife.call(this);
      }

      function collectCoin(player, coin) {
        coin.disableBody(true, true);
        score += 10;
        scoreText.setText('Score: ' + score);
        if (coins.countActive(true) === 0) victory.call(this);
      }

      function hitEnemy() { loseLife.call(this); }

      function loseLife() {
        lives--;
        livesText.setText('❤️ ' + lives);
        if (lives <= 0) gameOver.call(this);
        else player.setPosition(50, ${g.gameConfig.height - 100});
      }

      function gameOver() {
        isGameOver = true;
        this.physics.pause();
        player.setTint(0xff0000);
        showOverlay.call(this, 'GAME OVER', '#ff5566', score);
      }

      function victory() {
        isGameOver = true;
        this.physics.pause();
        showOverlay.call(this, 'VICTORY! 🎉', '#ffd700', score);
      }

      function showOverlay(text, color, finalScore) {
        const w = ${g.gameConfig.width}, h = ${g.gameConfig.height};
        this.add.rectangle(w/2, h/2, w, h, 0x000000, 0.75);
        this.add.text(w/2, h/2 - 50, text, { fontSize: '56px', fontFamily: 'Arial Black', fill: color, stroke: '#000', strokeThickness: 6 }).setOrigin(0.5);
        this.add.text(w/2, h/2 + 20, 'Score: ' + finalScore, { fontSize: '28px', fill: '#fff' }).setOrigin(0.5);
        this.add.text(w/2, h/2 + 70, 'Press R to Restart', { fontSize: '18px', fill: '#a855f7' }).setOrigin(0.5);
        this.input.keyboard.on('keydown-R', () => location.reload());
      }
    `, '⬅️ ➡️ Move | SPACE Jump | Collect coins!');
  },

  // ============= 2D SHOOTER =============
  shooter(g) {
    const title = g.metadata.gameTitle;
    return this.htmlWrapper(title, g.gameConfig.backgroundColor, `
      let player, cursors, wasd, bullets, enemies, scoreText, livesText, lastFired = 0;
      let score = 0, lives = ${g.player.lives}, isGameOver = false;
      const stars = [];

      const config = {
        type: Phaser.AUTO, width: 800, height: 600, parent: 'game-container',
        physics: { default: 'arcade', arcade: { debug: false }}, scene: { preload, create, update }
      };
      const game = new Phaser.Game(config);

      function preload() {
        const p = this.add.graphics();
        p.fillStyle(${g.player.color}); p.fillTriangle(20, 0, 0, 40, 40, 40);
        p.generateTexture('player', 40, 40); p.destroy();
        const e = this.add.graphics();
        e.fillStyle(${g.enemies.color}); e.fillRect(0, 0, 32, 32);
        e.fillStyle(0xffffff, 0.5); e.fillCircle(8, 8, 4); e.fillCircle(24, 8, 4);
        e.generateTexture('enemy', 32, 32); e.destroy();
        const b = this.add.graphics();
        b.fillStyle(${g.collectibles.color}); b.fillRect(0, 0, 4, 12);
        b.generateTexture('bullet', 4, 12); b.destroy();
      }

      function create() {
        for (let i = 0; i < 100; i++) {
          const s = this.add.circle(Phaser.Math.Between(0, 800), Phaser.Math.Between(0, 600), Phaser.Math.Between(1, 2), 0xffffff, Phaser.Math.FloatBetween(0.3, 1));
          s.speed = Phaser.Math.Between(50, 200); stars.push(s);
        }
        player = this.physics.add.sprite(400, 500, 'player');
        player.setCollideWorldBounds(true);
        bullets = this.physics.add.group({ defaultKey: 'bullet', maxSize: 30 });
        enemies = this.physics.add.group();
        this.physics.add.overlap(bullets, enemies, hitEnemy, null, this);
        this.physics.add.overlap(player, enemies, playerHit, null, this);
        this.time.addEvent({ delay: ${g.enemies.spawnRate}, callback: spawnEnemy, callbackScope: this, loop: true });
        cursors = this.input.keyboard.createCursorKeys();
        wasd = this.input.keyboard.addKeys('W,A,S,D');
        scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '22px', fontFamily: 'Arial Black', fill: '#00ffff', stroke: '#000', strokeThickness: 4 });
        livesText = this.add.text(16, 46, '❤️ ' + lives, { fontSize: '22px', fontFamily: 'Arial Black', fill: '#ff5566' });
      }

      function update(time, delta) {
        if (isGameOver) return;
        stars.forEach(s => { s.y += s.speed * delta / 1000; if (s.y > 600) { s.y = 0; s.x = Phaser.Math.Between(0, 800); }});
        const speed = ${g.player.speed};
        player.setVelocity(0);
        if (cursors.left.isDown || wasd.A.isDown) player.setVelocityX(-speed);
        if (cursors.right.isDown || wasd.D.isDown) player.setVelocityX(speed);
        if (cursors.up.isDown || wasd.W.isDown) player.setVelocityY(-speed);
        if (cursors.down.isDown || wasd.S.isDown) player.setVelocityY(speed);
        if (cursors.space.isDown && time > lastFired) {
          const b = bullets.get(player.x, player.y - 20);
          if (b) { b.setActive(true).setVisible(true); b.body.reset(player.x, player.y - 20); b.body.setAllowGravity(false); b.setVelocityY(-500); lastFired = time + 200; }
        }
        bullets.children.each(b => { if (b.active && b.y < 0) b.setActive(false).setVisible(false); });
      }

      function spawnEnemy() {
        if (isGameOver) return;
        const enemy = enemies.create(Phaser.Math.Between(50, 750), -30, 'enemy');
        enemy.setVelocityY(${g.enemies.speed} + score / 10);
        enemy.body.setAllowGravity(false);
      }

      function hitEnemy(bullet, enemy) {
        bullet.setActive(false).setVisible(false);
        enemy.destroy();
        score += 10;
        scoreText.setText('Score: ' + score);
        this.cameras.main.shake(80, 0.005);
      }

      function playerHit(player, enemy) {
        enemy.destroy();
        lives--;
        livesText.setText('❤️ ' + lives);
        this.cameras.main.shake(200, 0.02);
        player.setTint(0xff0000);
        this.time.delayedCall(200, () => player.clearTint());
        if (lives <= 0) gameOver.call(this);
      }

      function gameOver() {
        isGameOver = true;
        this.physics.pause();
        this.add.rectangle(400, 300, 800, 600, 0x000000, 0.8);
        this.add.text(400, 250, 'GAME OVER', { fontSize: '56px', fontFamily: 'Arial Black', fill: '#ff0066' }).setOrigin(0.5);
        this.add.text(400, 320, 'Score: ' + score, { fontSize: '28px', fill: '#00ffff' }).setOrigin(0.5);
        this.add.text(400, 380, 'Press R to Restart', { fontSize: '18px', fill: '#ffd700' }).setOrigin(0.5);
        this.input.keyboard.on('keydown-R', () => location.reload());
      }
    `, 'WASD/Arrows Move | SPACE Shoot');
  },

  // ============= 2D RUNNER =============
  runner(g) {
    const speed = g.gameConfig.gameSpeed || 450;
    return this.htmlWrapper(g.metadata.gameTitle, g.gameConfig.backgroundColor, `
      let player, ground, obstacles, scoreText, score = 0;
      let isGameOver = false, gameSpeed = ${speed};

      const config = {
        type: Phaser.AUTO, width: 800, height: 400, parent: 'game-container',
        physics: { default: 'arcade', arcade: { gravity: { y: ${g.gameConfig.physics.gravity} }, debug: false }},
        scene: { preload, create, update }
      };
      const game = new Phaser.Game(config);

      function preload() {
        const p = this.add.graphics();
        p.fillStyle(${g.player.color}); p.fillRoundedRect(0, 0, 40, 40, 8);
        p.fillStyle(0xffffff); p.fillCircle(28, 12, 4);
        p.generateTexture('player', 40, 40); p.destroy();
        const o = this.add.graphics();
        o.fillStyle(${g.enemies.color}); o.fillRect(0, 0, 30, 60);
        o.generateTexture('obstacle', 30, 60); o.destroy();
        const gnd = this.add.graphics();
        gnd.fillStyle(0x4a4a6e); gnd.fillRect(0, 0, 800, 50);
        gnd.generateTexture('ground', 800, 50); gnd.destroy();
      }

      function create() {
        for (let i = 0; i < 5; i++) {
          this.add.triangle(i * 200, 350, 0, 0, 100, -150, 200, 0, 0x2d2d4a).setOrigin(0.5, 1);
        }
        ground = this.physics.add.staticGroup();
        ground.create(400, 380, 'ground').refreshBody();
        player = this.physics.add.sprite(150, 300, 'player');
        player.setCollideWorldBounds(true);
        this.physics.add.collider(player, ground);
        obstacles = this.physics.add.group();
        this.physics.add.collider(obstacles, ground);
        this.physics.add.overlap(player, obstacles, hitObstacle, null, this);
        this.time.addEvent({ delay: ${g.enemies.spawnRate}, callback: spawnObstacle, callbackScope: this, loop: true });
        scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '22px', fontFamily: 'Arial Black', fill: '#fff', stroke: '#ff6b35', strokeThickness: 4 });
        this.input.keyboard.on('keydown-SPACE', () => { if (!isGameOver && player.body.touching.down) player.setVelocityY(${g.player.jumpVelocity}); });
        this.input.keyboard.on('keydown-UP', () => { if (!isGameOver && player.body.touching.down) player.setVelocityY(${g.player.jumpVelocity}); });
      }

      function update() {
        if (isGameOver) return;
        score += 0.1;
        scoreText.setText('Score: ' + Math.floor(score));
        gameSpeed = ${speed} + score / 5;
        obstacles.children.each(o => { if (o.x < -50) o.destroy(); });
      }

      function spawnObstacle() {
        if (isGameOver) return;
        const o = obstacles.create(800, 320 + Phaser.Math.Between(-90, -30), 'obstacle');
        o.body.setAllowGravity(false);
        o.setVelocityX(-gameSpeed);
        o.setImmovable(true);
      }

      function hitObstacle() {
        isGameOver = true;
        this.physics.pause();
        player.setTint(0xff0000);
        this.cameras.main.shake(300, 0.02);
        this.add.rectangle(400, 200, 800, 400, 0x000000, 0.8);
        this.add.text(400, 150, 'GAME OVER', { fontSize: '52px', fontFamily: 'Arial Black', fill: '#ff6b35' }).setOrigin(0.5);
        this.add.text(400, 220, 'Score: ' + Math.floor(score), { fontSize: '28px', fill: '#fff' }).setOrigin(0.5);
        this.add.text(400, 280, 'Press R to Restart', { fontSize: '18px', fill: '#ffd700' }).setOrigin(0.5);
        this.input.keyboard.on('keydown-R', () => location.reload());
      }
    `, 'SPACE/UP Jump | Avoid obstacles!');
  },

  // ============= 2D BREAKOUT =============
  breakout(g) {
    const ballSpeed = g.level.ballSpeed || 350;
    const rows = g.level.brickRows || 5;
    const cols = g.level.brickCols || 10;
    return this.htmlWrapper(g.metadata.gameTitle, g.gameConfig.backgroundColor, `
      let paddle, ball, bricks, scoreText, livesText, cursors;
      let score = 0, lives = ${g.player.lives}, ballLaunched = false;

      const config = {
        type: Phaser.AUTO, width: 800, height: 600, parent: 'game-container',
        physics: { default: 'arcade', arcade: { debug: false }}, scene: { preload, create, update }
      };
      const game = new Phaser.Game(config);

      function preload() {
        const p = this.add.graphics();
        p.fillStyle(${g.player.color}); p.fillRoundedRect(0, 0, 100, 16, 8);
        p.generateTexture('paddle', 100, 16); p.destroy();
        const b = this.add.graphics();
        b.fillStyle(0xffffff); b.fillCircle(8, 8, 8);
        b.generateTexture('ball', 16, 16); b.destroy();
      }

      function create() {
        for (let i = 0; i < 100; i++) {
          this.add.circle(Phaser.Math.Between(0, 800), Phaser.Math.Between(0, 600), Phaser.Math.Between(1, 2), 0xffffff, Phaser.Math.FloatBetween(0.2, 0.8));
        }
        paddle = this.physics.add.sprite(400, 550, 'paddle').setImmovable(true);
        paddle.body.setAllowGravity(false);
        paddle.setCollideWorldBounds(true);
        ball = this.physics.add.sprite(400, 530, 'ball');
        ball.body.setAllowGravity(false);
        ball.setCollideWorldBounds(true);
        ball.setBounce(1, 1);

        bricks = this.physics.add.staticGroup();
        const colors = [0xff0066, 0xff6b35, 0xffd700, 0x00ffaa, 0x3b82f6, 0xa855f7, 0xec4899];
        for (let row = 0; row < ${rows}; row++) {
          for (let col = 0; col < ${cols}; col++) {
            const x = 80 + col * 64;
            const y = 80 + row * 30;
            const brick = this.add.rectangle(x, y, 56, 24, colors[row % colors.length]);
            this.physics.add.existing(brick, true);
            bricks.add(brick);
          }
        }
        this.physics.add.collider(ball, paddle, hitPaddle, null, this);
        this.physics.add.collider(ball, bricks, hitBrick, null, this);
        cursors = this.input.keyboard.createCursorKeys();
        this.input.keyboard.on('keydown-SPACE', () => { if (!ballLaunched) { ballLaunched = true; ball.setVelocity(Phaser.Math.Between(-100, 100), -${ballSpeed}); }});
        scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '20px', fontFamily: 'Arial Black', fill: '#00ffaa' });
        livesText = this.add.text(680, 16, '❤️ ' + lives, { fontSize: '20px', fontFamily: 'Arial Black', fill: '#ff5566' });
      }

      function update() {
        if (cursors.left.isDown) paddle.setVelocityX(-${g.player.speed});
        else if (cursors.right.isDown) paddle.setVelocityX(${g.player.speed});
        else paddle.setVelocityX(0);
        if (!ballLaunched) ball.setPosition(paddle.x, paddle.y - 20);
        if (ball.y > 580) {
          lives--;
          livesText.setText('❤️ ' + lives);
          if (lives <= 0) gameOver.call(this);
          else { ballLaunched = false; ball.setVelocity(0, 0); }
        }
      }

      function hitPaddle(ball, paddle) { ball.setVelocityX((ball.x - paddle.x) * 8); }
      function hitBrick(ball, brick) {
        brick.destroy();
        score += 10;
        scoreText.setText('Score: ' + score);
        if (bricks.countActive() === 0) victory.call(this);
      }
      function gameOver() {
        this.physics.pause();
        this.add.rectangle(400, 300, 800, 600, 0x000000, 0.8);
        this.add.text(400, 250, 'GAME OVER', { fontSize: '56px', fontFamily: 'Arial Black', fill: '#ff5566' }).setOrigin(0.5);
        this.add.text(400, 330, 'Score: ' + score, { fontSize: '28px', fill: '#fff' }).setOrigin(0.5);
        this.add.text(400, 390, 'Press R to Restart', { fontSize: '18px', fill: '#00ffaa' }).setOrigin(0.5);
        this.input.keyboard.on('keydown-R', () => location.reload());
      }
      function victory() {
        this.physics.pause();
        this.add.rectangle(400, 300, 800, 600, 0x000000, 0.8);
        this.add.text(400, 250, 'VICTORY! 🎉', { fontSize: '56px', fontFamily: 'Arial Black', fill: '#ffd700' }).setOrigin(0.5);
        this.add.text(400, 330, 'Score: ' + score, { fontSize: '28px', fill: '#fff' }).setOrigin(0.5);
      }
    `, '⬅️ ➡️ Move | SPACE to launch');
  },

  // ============= 2D RPG / MAZE =============
  rpg(g) {
    const map = g.level.walls && g.level.walls.length > 0 ? g.level.walls : [
      '################',
      '#P.....#.......#',
      '#.###..#..###..#',
      '#.#T#..#..#E.#.#',
      '#.#.#.....#..#.#',
      '#.#.######.###.#',
      '#.#............#',
      '#.######.######',
      '#.....#..#....#',
      '#.###.#..#.##.#',
      '#.#T#.E..E.#T#.#',
      '#.#.#......#.#.#',
      '#.#.########.#.#',
      '#.............#',
      '#######.#######',
      '#......G......#',
      '################'
    ];
    return this.htmlWrapper(g.metadata.gameTitle, g.gameConfig.backgroundColor, `
      const MAP = ${JSON.stringify(map)};
      let player, walls, treasures, enemies, scoreText, healthText, cursors, wasd;
      let score = 0, health = ${g.player.lives * 100}, isGameOver = false;

      const config = {
        type: Phaser.AUTO, width: 800, height: 600, parent: 'game-container',
        physics: { default: 'arcade', arcade: { debug: false }}, scene: { preload, create, update }
      };
      const game = new Phaser.Game(config);

      function preload() {
        const p = this.add.graphics();
        p.fillStyle(${g.player.color}); p.fillCircle(16, 16, 14);
        p.fillStyle(0x000); p.fillCircle(11, 12, 2); p.fillCircle(21, 12, 2);
        p.generateTexture('player', 32, 32); p.destroy();
        const w = this.add.graphics();
        w.fillStyle(0x4a4a6e); w.fillRect(0, 0, 32, 32);
        w.lineStyle(2, 0x666688); w.strokeRect(0, 0, 32, 32);
        w.generateTexture('wall', 32, 32); w.destroy();
        const t = this.add.graphics();
        t.fillStyle(${g.collectibles.color}); t.fillRect(4, 8, 24, 16);
        t.fillStyle(0xff6b35); t.fillRect(8, 4, 16, 8);
        t.generateTexture('treasure', 32, 32); t.destroy();
        const e = this.add.graphics();
        e.fillStyle(${g.enemies.color}); e.fillCircle(16, 16, 14);
        e.fillStyle(0xffff00); e.fillCircle(11, 12, 3); e.fillCircle(21, 12, 3);
        e.generateTexture('enemy', 32, 32); e.destroy();
      }

      function create() {
        walls = this.physics.add.staticGroup();
        treasures = this.physics.add.group();
        enemies = this.physics.add.group();
        const tile = 32, ox = 80, oy = 30;
        MAP.forEach((row, y) => {
          [...row].forEach((c, x) => {
            const px = ox + x * tile + tile/2, py = oy + y * tile + tile/2;
            if (c === '#') walls.create(px, py, 'wall').refreshBody();
            else if (c === 'P') { player = this.physics.add.sprite(px, py, 'player'); player.setCollideWorldBounds(true); }
            else if (c === 'T') { const t = treasures.create(px, py, 'treasure'); t.body.setAllowGravity(false); this.tweens.add({ targets: t, y: py - 4, duration: 800, yoyo: true, repeat: -1 }); }
            else if (c === 'E') { const en = enemies.create(px, py, 'enemy'); en.body.setAllowGravity(false); en.setVelocity(Phaser.Math.Between(-60, 60), Phaser.Math.Between(-60, 60)); }
            else if (c === 'G') { const goal = this.add.rectangle(px, py, 28, 28, 0x00ff00); this.physics.add.existing(goal); goal.body.setAllowGravity(false); goal.body.setImmovable(true); this.physics.add.overlap(player, goal, () => victory.call(this)); }
          });
        });
        this.physics.add.collider(player, walls);
        this.physics.add.collider(enemies, walls, e => e.setVelocity(Phaser.Math.Between(-60, 60), Phaser.Math.Between(-60, 60)));
        this.physics.add.overlap(player, treasures, (p, t) => { t.disableBody(true, true); score += 50; scoreText.setText('💰 ' + score); }, null, this);
        this.physics.add.overlap(player, enemies, () => { health--; healthText.setText('❤️ ' + health); player.setTint(0xff0000); this.time.delayedCall(100, () => player.clearTint()); if (health <= 0) gameOver.call(this); }, null, this);
        cursors = this.input.keyboard.createCursorKeys();
        wasd = this.input.keyboard.addKeys('W,A,S,D');
        scoreText = this.add.text(16, 16, '💰 0', { fontSize: '20px', fontFamily: 'Arial Black', fill: '#ffd700' });
        healthText = this.add.text(16, 44, '❤️ ' + health, { fontSize: '20px', fontFamily: 'Arial Black', fill: '#ff5566' });
      }

      function update() {
        if (isGameOver || !player) return;
        const speed = ${g.player.speed};
        player.setVelocity(0);
        if (cursors.left.isDown || wasd.A.isDown) player.setVelocityX(-speed);
        if (cursors.right.isDown || wasd.D.isDown) player.setVelocityX(speed);
        if (cursors.up.isDown || wasd.W.isDown) player.setVelocityY(-speed);
        if (cursors.down.isDown || wasd.S.isDown) player.setVelocityY(speed);
      }

      function gameOver() {
        isGameOver = true;
        this.physics.pause();
        this.add.rectangle(400, 300, 800, 600, 0x000000, 0.8);
        this.add.text(400, 250, 'YOU DIED', { fontSize: '56px', fontFamily: 'Arial Black', fill: '#ff0000' }).setOrigin(0.5);
        this.add.text(400, 330, '💰 ' + score, { fontSize: '24px', fill: '#fff' }).setOrigin(0.5);
        this.add.text(400, 390, 'Press R to Restart', { fontSize: '18px', fill: '#ffd700' }).setOrigin(0.5);
        this.input.keyboard.on('keydown-R', () => location.reload());
      }
      function victory() {
        if (isGameOver) return;
        isGameOver = true;
        this.physics.pause();
        this.add.rectangle(400, 300, 800, 600, 0x000000, 0.8);
        this.add.text(400, 250, '🏆 VICTORY!', { fontSize: '56px', fontFamily: 'Arial Black', fill: '#00ff00' }).setOrigin(0.5);
        this.add.text(400, 330, '💰 ' + score + ' | ❤️ ' + health, { fontSize: '24px', fill: '#fff' }).setOrigin(0.5);
      }
    `, 'WASD/Arrows Move | Find treasure, reach the green goal!');
  },

  // ============= 3D EXPLORER (Three.js) =============
  'explorer-fp'(g) {
    const obstacles = JSON.stringify(g.world.obstacles);
    const collectibles = JSON.stringify(g.world.collectibles);
    const enemySpawns = JSON.stringify(g.enemies.spawnPositions);

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${this.escapeHTML(g.metadata.gameTitle)}</title>
  <style>
    body { margin:0; padding:0; background:${g.scene.backgroundColor}; overflow:hidden; font-family:Arial; }
    canvas { display:block; }
    #hud { position:fixed; top:16px; left:16px; color:#fff; font-size:18px; font-weight:bold; text-shadow:0 0 10px rgba(0,0,0,0.8); z-index:10; }
    #crosshair { position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); color:#fff; font-size:24px; z-index:10; pointer-events:none; opacity:0.7; }
    #info { position:fixed; bottom:16px; left:50%; transform:translateX(-50%); color:#fff; font-size:14px; opacity:0.7; z-index:10; text-align:center; background:rgba(0,0,0,0.5); padding:8px 16px; border-radius:8px; }
    #click-to-start { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.7); color:#fff; font-size:32px; cursor:pointer; z-index:100; flex-direction:column; gap:16px; }
    #click-to-start small { font-size:14px; opacity:0.7; }
  </style>
</head>
<body>
  <div id="hud">
    <div>💎 Score: <span id="score">0</span></div>
    <div>❤️ Lives: <span id="lives">${g.player.lives}</span></div>
  </div>
  <div id="crosshair">+</div>
  <div id="info">WASD Move | MOUSE Look | SPACE Jump | E Interact</div>
  <div id="click-to-start">
    <div>${this.escapeHTML(g.metadata.gameTitle)}</div>
    <small>Click to start</small>
  </div>

  <script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.155.0/build/three.module.js",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.155.0/examples/jsm/"
    }
  }
  </script>
  <script type="module">
    import * as THREE from 'three';
    import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

    const OBSTACLES = ${obstacles};
    const COLLECTIBLES = ${collectibles};
    const ENEMY_SPAWNS = ${enemySpawns};

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('${g.scene.backgroundColor}');
    ${g.scene.fog.enabled ? `scene.fog = new THREE.Fog('${g.scene.fog.color}', ${g.scene.fog.near}, ${g.scene.fog.far});` : ''}

    const camera = new THREE.PerspectiveCamera(${g.camera.fov}, window.innerWidth / window.innerHeight, ${g.camera.near}, ${g.camera.far});
    camera.position.set(${g.camera.initialPosition.x}, ${g.camera.initialPosition.y}, ${g.camera.initialPosition.z});

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    // Lights
    const ambient = new THREE.AmbientLight('${g.lighting.ambient.color}', ${g.lighting.ambient.intensity});
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight('${g.lighting.directional.color}', ${g.lighting.directional.intensity});
    dirLight.position.set(${g.lighting.directional.position.x}, ${g.lighting.directional.position.y}, ${g.lighting.directional.position.z});
    dirLight.castShadow = ${g.lighting.directional.castShadow};
    dirLight.shadow.mapSize.set(2048, 2048);
    scene.add(dirLight);

    // Ground
    const groundGeo = new THREE.PlaneGeometry(${g.world.ground.size}, ${g.world.ground.size});
    const groundMat = new THREE.MeshStandardMaterial({ color: ${g.world.ground.color}, roughness: 0.8 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Obstacles
    const obstacleMeshes = [];
    OBSTACLES.forEach(o => {
      const geo = new THREE.BoxGeometry(o.size.width, o.size.height, o.size.depth);
      const mat = new THREE.MeshStandardMaterial({ color: o.color, roughness: 0.5, metalness: 0.3 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(o.position.x, o.position.y, o.position.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      obstacleMeshes.push(mesh);
      scene.add(mesh);
    });

    // Collectibles (animated crystals)
    const collectibleMeshes = [];
    COLLECTIBLES.forEach(c => {
      const geo = new THREE.OctahedronGeometry(0.4);
      const mat = new THREE.MeshStandardMaterial({ color: c.color, emissive: c.color, emissiveIntensity: 0.5, metalness: 0.7, roughness: 0.2 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(c.position.x, c.position.y, c.position.z);
      mesh.userData.value = c.value;
      mesh.userData.startY = c.position.y;
      mesh.castShadow = true;
      collectibleMeshes.push(mesh);
      scene.add(mesh);
    });

    // Enemies
    const enemyMeshes = [];
    ENEMY_SPAWNS.slice(0, ${g.enemies.count}).forEach(pos => {
      const geo = new THREE.BoxGeometry(1, 1.5, 1);
      const mat = new THREE.MeshStandardMaterial({ color: ${g.enemies.color}, emissive: ${g.enemies.color}, emissiveIntensity: 0.3 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos.x, pos.y, pos.z);
      mesh.castShadow = true;
      enemyMeshes.push(mesh);
      scene.add(mesh);
    });

    // Controls
    const controls = new PointerLockControls(camera, renderer.domElement);
    document.getElementById('click-to-start').addEventListener('click', () => controls.lock());
    controls.addEventListener('lock', () => document.getElementById('click-to-start').style.display = 'none');
    controls.addEventListener('unlock', () => document.getElementById('click-to-start').style.display = 'flex');

    // Movement
    const move = { f: false, b: false, l: false, r: false };
    const velocity = new THREE.Vector3();
    const direction = new THREE.Vector3();
    let canJump = false;
    let verticalVel = 0;

    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') move.f = true;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') move.b = true;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') move.l = true;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') move.r = true;
      if (e.code === 'Space' && canJump) { verticalVel = ${g.player.jumpForce}; canJump = false; }
    });
    document.addEventListener('keyup', (e) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') move.f = false;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') move.b = false;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') move.l = false;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') move.r = false;
    });

    // Game state
    let score = 0, lives = ${g.player.lives};
    const clock = new THREE.Clock();

    function animate() {
      requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.1);

      if (controls.isLocked) {
        const speed = ${g.player.moveSpeed};
        direction.z = Number(move.f) - Number(move.b);
        direction.x = Number(move.r) - Number(move.l);
        direction.normalize();

        velocity.x = direction.x * speed * delta;
        velocity.z = direction.z * speed * delta;

        controls.moveRight(velocity.x);
        controls.moveForward(velocity.z);

        // Gravity
        verticalVel += ${g.physics.gravity.y} * delta;
        camera.position.y += verticalVel * delta;
        if (camera.position.y < ${g.camera.initialPosition.y}) {
          camera.position.y = ${g.camera.initialPosition.y};
          verticalVel = 0;
          canJump = true;
        }

        // Animate collectibles
        const t = clock.elapsedTime;
        collectibleMeshes.forEach((m, i) => {
          m.rotation.y += delta * 2;
          m.position.y = m.userData.startY + Math.sin(t * 2 + i) * 0.2;

          // Pickup
          if (m.position.distanceTo(camera.position) < 1.5) {
            score += m.userData.value;
            document.getElementById('score').textContent = score;
            scene.remove(m);
            collectibleMeshes.splice(i, 1);
          }
        });

        // Enemy AI
        enemyMeshes.forEach(e => {
          const dir = new THREE.Vector3().subVectors(camera.position, e.position).normalize();
          dir.y = 0;
          e.position.add(dir.multiplyScalar(${g.enemies.moveSpeed} * delta));
          e.rotation.y += delta;

          if (e.position.distanceTo(camera.position) < 1.5) {
            lives--;
            document.getElementById('lives').textContent = lives;
            // Knockback
            e.position.add(dir.multiplyScalar(-3));
            if (lives <= 0) {
              alert('Game Over! Final Score: ' + score);
              location.reload();
            }
          }
        });
      }

      renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  </script>
</body>
</html>`;
  },

  // Helper: HTML wrapper for 2D games
  escapeHTML(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  safeCssColor(value) {
    const color = String(value || '').trim();
    return /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : '#111827';
  },

  htmlWrapper(title, bgColor, gameCode, info) {
    const safeTitle = this.escapeHTML(title);
    const safeInfo = this.escapeHTML(info);
    const safeBgColor = this.safeCssColor(bgColor);
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${safeTitle}</title>
  <script src="https://cdn.jsdelivr.net/npm/phaser@3.70.0/dist/phaser.min.js"></script>
  <style>
    body { margin:0; padding:0; background:${safeBgColor}; display:flex; justify-content:center; align-items:center; min-height:100vh; font-family:Arial; color:white; flex-direction:column; }
    #game-container { box-shadow: 0 0 40px rgba(168,85,247,0.4); border-radius: 8px; overflow: hidden; }
    h1 { margin-bottom: 12px; background: linear-gradient(135deg, #a855f7, #3b82f6); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; font-size: 28px; }
    .info { margin-top: 12px; font-size: 13px; opacity: 0.7; }
  </style>
</head>
<body>
  <h1>${safeTitle}</h1>
  <div id="game-container"></div>
  <div class="info">${safeInfo}</div>
  <script>${gameCode}</script>
</body>
</html>`;
  }
};

window.GameTemplates = GameTemplates;
