class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
    this.tileSize = 32;
    this.gridWidth = 20;
    this.gridHeight = 20;
    this.basePlayerSpeed = 160;
    this.baseHunterSpeed = 100;
  }

  init(data) {
    this.level = data.level || 1;
    this.score = data.score || 0;
    this.highScore = data.highScore || this.readHighScore();
    this.lives = data.lives || 3;

    this.invulnerable = false;
    this.gameOver = false;
    this.transitioning = false;
    this.teleporting = false;
    this.nextDirection = { x: 0, y: 0 };
    this.playerSoundEnabled = true;
    this.playerUseRotatingOnlyAnimation = false;
    this.playerAudioOnlyOnRotatingFrames = true;
    this.playerRotatingNow = false;
  }

  create() {
    this.cursors = this.input.keyboard.createCursorKeys();

    this.levelLayout = window.GameLevels[this.level] || window.GameLevels[2];

    this.pelletByCell = new Map();
    this.playerSpawnCell = { x: 7, y: 7 };
    this.hunterSpawnCells = [];

    this.buildLevel();
    this.createActors();
    this.createHud();
    this.initPlayerAudio();

    // Remove pellet under the player at start
    this.collectPelletAt(this.playerAgent.cellX, this.playerAgent.cellY);
  }

  initPlayerAudio() {
    this.playerAudio = this.sound.add("player_audio", {
      loop: true,
      volume: 0.25,
    });

    this.events.once("shutdown", this.teardownPlayerAudio, this);
    this.events.once("destroy", this.teardownPlayerAudio, this);
  }

  teardownPlayerAudio() {
    if (!this.playerAudio) return;

    if (this.playerAudio.isPlaying) {
      this.playerAudio.stop();
    }
    this.playerAudio.destroy();
    this.playerAudio = null;
  }

  update(time, delta) {
    if (this.gameOver) {
      return;
    }

    if (this.transitioning || this.teleporting) return;

    this.readPlayerInput();
    this.movePlayer(delta);
    this.checkSpecialTriggers(time);
    this.moveHunters(delta, time);
    this.checkHunterContact();
  }

  /* ------------------------------------------------------------------ */
  /*  Level building                                                     */
  /* ------------------------------------------------------------------ */

  buildLevel() {
    for (let row = 0; row < this.gridHeight; row++) {
      for (let col = 0; col < this.gridWidth; col++) {
        const cell = this.levelLayout[row][col];
        const wx = this.gridToWorld(col);
        const wy = this.gridToWorld(row);

        if (cell === "#") {
          // Walls are drawn later mathematically
        } else if (cell === ".") {
          const pellet = this.add.image(wx, wy, "pellet").setDepth(2);
          this.pelletByCell.set(`${col},${row}`, pellet);
        } else if (cell === "P") {
          this.playerSpawnCell = { x: col, y: row };
        } else if (cell === "H" || cell === "K" || cell === "C" || cell === "M") {
          this.hunterSpawnCells.push({ x: col, y: row, type: cell });
        }
      }
    }

    if (this.hunterSpawnCells.length === 0) {
      this.hunterSpawnCells.push({ x: 10, y: 10, type: "H" });
    }

    this.drawTubularWalls();
  }

  drawTubularWalls() {
    const gfx = this.add.graphics().setDepth(1);

    // Outer thick blue tubes
    gfx.fillStyle(0x1d4ed8, 1);
    this.drawTubes(gfx, 4, 16);

    // Inner black tubes to hollow them out
    gfx.fillStyle(0x0f172a, 1);
    this.drawTubes(gfx, 8, 12);
  }

  drawTubes(gfx, margin, cornerRadius) {
    const ts = this.tileSize;
    const isW = (c, r) => r >= 0 && r < this.gridHeight && c >= 0 && c < this.gridWidth && this.levelLayout[r][c] === "#";

    for (let row = 0; row < this.gridHeight; row++) {
      for (let col = 0; col < this.gridWidth; col++) {
        if (!isW(col, row)) continue;

        const x = col * ts;
        const y = row * ts;
        const size = ts - 2 * margin;

        gfx.fillRoundedRect(x + margin, y + margin, size, size, cornerRadius);

        const half = ts / 2;
        if (isW(col, row - 1)) gfx.fillRect(x + margin, y, size, half);
        if (isW(col, row + 1)) gfx.fillRect(x + margin, y + half, size, half);
        if (isW(col - 1, row)) gfx.fillRect(x, y + margin, half, size);
        if (isW(col + 1, row)) gfx.fillRect(x + half, y + margin, half, size);
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Actor creation                                                     */
  /* ------------------------------------------------------------------ */

  createActors() {
    const px = this.gridToWorld(this.playerSpawnCell.x);
    const py = this.gridToWorld(this.playerSpawnCell.y);

    this.playerAgent = {
      sprite: this.add.sprite(px, py, "player_idle").setDepth(4),
      cellX: this.playerSpawnCell.x,
      cellY: this.playerSpawnCell.y,
      direction: { x: 0, y: 0 },
      moving: false,
      speed: this.basePlayerSpeed,
    };
    this.playerAgent.sprite.setDisplaySize(this.tileSize + 15, this.tileSize + 15);
    this.updatePlayerVisualState();

    this.hunters = this.hunterSpawnCells.map((spawn, i) => {
      const sx = this.gridToWorld(spawn.x);
      const sy = this.gridToWorld(spawn.y);

      let spriteKey = "hunter";
      if (spawn.type === "C") {
        spriteKey = "chin_tapak";
      } else if (spawn.type === "M") {
        spriteKey = "max_hunter";
      }

      const sprite = this.add.sprite(sx, sy, spriteKey).setDepth(4);

      if (spriteKey === "chin_tapak") {
        sprite.setDisplaySize(46, 46);
      } else if (spriteKey === "max_hunter") {
        sprite.setDisplaySize(35, 35);
      } else if (spawn.type !== "C" && spawn.type !== "M" && i === 1) {
        sprite.setTint(0xfb923c);
      }

      return {
        sprite,
        type: spawn.type,
        cellX: spawn.x,
        cellY: spawn.y,
        spawnCellX: spawn.x,
        spawnCellY: spawn.y,
        direction: { x: 0, y: 0 },
        moving: false,
        speed: this.baseHunterSpeed + (spriteKey === "max_hunter" ? 10 : i * 8),
        decisionAt: 0,
        lastTeleportTime: -30000,
        isSprinting: false,
      };
    });
  }

  /* ------------------------------------------------------------------ */
  /*  HUD                                                                */
  /* ------------------------------------------------------------------ */

  createHud() {
    this.hudStyle = {
      fontFamily: "Trebuchet MS",
      fontSize: "20px",
      color: "#e2e8f0",
      stroke: "#020617",
      strokeThickness: 4,
    };

    this.scoreText = this.add.text(20, 655, "", this.hudStyle).setDepth(6);
    this.levelText = this.add.text(200, 655, "", this.hudStyle).setDepth(6);

    this.livesIcons = [];
    for (let i = 0; i < 3; i++) {
      const heart = this.add.image(520 + i * 40, 668, "heart").setDepth(6);
      this.livesIcons.push(heart);
    }

    this.noticeText = this.add
      .text(this.scale.width / 2, (this.scale.height - 60) / 2, "", {
        fontFamily: "Trebuchet MS",
        fontSize: "34px",
        color: "#f8fafc",
        stroke: "#020617",
        strokeThickness: 6,
      })
      .setDepth(7)
      .setOrigin(0.5)
      .setVisible(false);

    this.refreshHud();
  }

  /* ------------------------------------------------------------------ */
  /*  Input                                                              */
  /* ------------------------------------------------------------------ */

  readPlayerInput() {
    if (this.cursors.left.isDown) this.nextDirection = { x: -1, y: 0 };
    else if (this.cursors.right.isDown) this.nextDirection = { x: 1, y: 0 };
    else if (this.cursors.up.isDown) this.nextDirection = { x: 0, y: -1 };
    else if (this.cursors.down.isDown) this.nextDirection = { x: 0, y: 1 };
  }

  /* ------------------------------------------------------------------ */
  /*  Player movement                                                    */
  /* ------------------------------------------------------------------ */

  movePlayer(delta) {
    const agent = this.playerAgent;

    // Allow instant 180° reversal while moving
    if (agent.moving && (agent.direction.x !== 0 || agent.direction.y !== 0)) {
      const reversing =
        this.nextDirection.x === -agent.direction.x &&
        this.nextDirection.y === -agent.direction.y;
      if (reversing) {
        agent.cellX += agent.direction.x;
        agent.cellY += agent.direction.y;
        agent.direction = { ...this.nextDirection };
      }
    }

    // Advance towards target cell
    if (agent.moving) {
      this.advanceAgent(agent, delta);
      if (!agent.moving) {
        this.collectPelletAt(agent.cellX, agent.cellY);
      }
    }

    // If stopped, decide next direction
    if (!agent.moving) {
      // Try buffered direction first
      if (this.canMove(agent.cellX + this.nextDirection.x, agent.cellY + this.nextDirection.y)) {
        agent.direction = { ...this.nextDirection };
      }
      // Validate current direction
      if (!this.canMove(agent.cellX + agent.direction.x, agent.cellY + agent.direction.y)) {
        agent.direction = { x: 0, y: 0 };
      }
      // Start moving if we have a valid direction
      if (agent.direction.x !== 0 || agent.direction.y !== 0) {
        agent.moving = true;
      }
    }

    this.updatePlayerVisualState();
  }

  updatePlayerVisualState() {
    const sprite = this.playerAgent.sprite;

    if (this.playerAgent.moving) {
      const nextAnim = this.playerUseRotatingOnlyAnimation ? "player-run-rotating" : "player-run";
      if (!sprite.anims.isPlaying || sprite.anims.currentAnim?.key !== nextAnim) {
        sprite.play(nextAnim, true);
      }
      this.playerRotatingNow = this.isPlayerInRotatingPhase();
      this.updatePlayerAudioState();
      return;
    }

    if (sprite.anims.isPlaying) {
      sprite.stop();
    }
    if (sprite.texture.key !== "player_idle") {
      sprite.setTexture("player_idle");
    }

    this.playerRotatingNow = false;
    this.updatePlayerAudioState();
  }

  isPlayerInRotatingPhase() {
    if (!this.playerAgent?.moving) return false;

    const currentKey = this.playerAgent.sprite.anims.currentAnim?.key;
    if (currentKey === "player-run-rotating") {
      return true;
    }

    if (currentKey !== "player-run") {
      return false;
    }

    const frame = Number(this.playerAgent.sprite.anims.currentFrame?.textureFrame ?? -1);
    if (Number.isNaN(frame)) {
      return false;
    }
    return frame >= 24 && frame <= 69;
  }

  updatePlayerAudioState() {
    if (!this.playerAudio) return;

    if (!this.playerSoundEnabled) {
      if (this.playerAudio.isPlaying) {
        this.playerAudio.stop();
      }
      return;
    }

    const shouldPlay = this.playerAgent.moving && (!this.playerAudioOnlyOnRotatingFrames || this.playerRotatingNow);

    if (shouldPlay) {
      if (!this.playerAudio.isPlaying) {
        this.playerAudio.play();
      }
      return;
    }

    if (this.playerAudio.isPlaying) {
      this.playerAudio.stop();
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Hunter movement                                                    */
  /* ------------------------------------------------------------------ */

  moveHunters(delta, time) {
    for (const hunter of this.hunters) {
      // Decide direction when at a cell center (not moving)
      if (!hunter.moving) {
        if (time >= hunter.decisionAt) {
          const start = { x: hunter.cellX, y: hunter.cellY };
          const goal = { x: this.playerAgent.cellX, y: this.playerAgent.cellY };
          const nextStep = this.findPathStep(start, goal);

          if (nextStep) {
            hunter.direction = {
              x: nextStep.x - start.x,
              y: nextStep.y - start.y,
            };
          }

          hunter.decisionAt = time + Phaser.Math.Between(120, 220);
        }

        // Validate / fallback
        if (!this.canMove(hunter.cellX + hunter.direction.x, hunter.cellY + hunter.direction.y)) {
          const dirs = [
            { x: 1, y: 0 },
            { x: -1, y: 0 },
            { x: 0, y: 1 },
            { x: 0, y: -1 },
          ].filter((d) => this.canMove(hunter.cellX + d.x, hunter.cellY + d.y));

          hunter.direction =
            dirs.length > 0
              ? Phaser.Utils.Array.GetRandom(dirs)
              : { x: 0, y: 0 };
        }

        if (hunter.direction.x !== 0 || hunter.direction.y !== 0) {
          hunter.moving = true;
        }
      }

      // Advance towards target cell
      if (hunter.moving) {
        const levelBoost = (this.level - 1) * 8;
        let speed = Phaser.Math.Clamp(hunter.speed + levelBoost, 95, 250);
        if (hunter.isSprinting) {
          speed = 180;
        }
        this.advanceAgent(hunter, delta, speed);
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Shared movement helper – moves sprite towards the next cell        */
  /* ------------------------------------------------------------------ */

  advanceAgent(agent, delta, speedOverride) {
    const speed = speedOverride || agent.speed;
    const move = speed * (delta / 1000);

    const targetX = this.gridToWorld(agent.cellX + agent.direction.x);
    const targetY = this.gridToWorld(agent.cellY + agent.direction.y);

    const dx = targetX - agent.sprite.x;
    const dy = targetY - agent.sprite.y;
    const dist = Math.abs(dx) + Math.abs(dy);

    if (dist <= move + 0.1) {
      // Arrived at next cell
      agent.cellX += agent.direction.x;
      agent.cellY += agent.direction.y;
      agent.sprite.setPosition(
        this.gridToWorld(agent.cellX),
        this.gridToWorld(agent.cellY)
      );
      agent.moving = false;
    } else {
      // Keep moving towards target
      agent.sprite.x += agent.direction.x * move;
      agent.sprite.y += agent.direction.y * move;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Pellet collection                                                  */
  /* ------------------------------------------------------------------ */

  collectPelletAt(cx, cy) {
    if (this.transitioning || this.gameOver) return;

    const key = `${cx},${cy}`;
    const pellet = this.pelletByCell.get(key);
    if (!pellet || !pellet.active) return;

    pellet.destroy();
    this.pelletByCell.delete(key);
    this.score += 1;
    this.refreshHud();

    if (this.pelletByCell.size === 0) {
      this.levelComplete();
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Hunter-player collision                                            */
  /* ------------------------------------------------------------------ */

  checkHunterContact() {
    if (this.invulnerable || this.transitioning || this.gameOver) return;

    for (const hunter of this.hunters) {
      const dist = Phaser.Math.Distance.Between(
        this.playerAgent.sprite.x,
        this.playerAgent.sprite.y,
        hunter.sprite.x,
        hunter.sprite.y
      );
      if (dist < this.tileSize * 0.55) {
        this.handlePlayerCaught();
        return;
      }
    }
  }

  checkSpecialTriggers(time) {
    if (this.transitioning || this.gameOver || this.teleporting || this.invulnerable) return;

    for (const hunter of this.hunters) {
      if (hunter.isSprinting) continue;

      const dist = Phaser.Math.Distance.Between(hunter.sprite.x, hunter.sprite.y, this.playerAgent.sprite.x, this.playerAgent.sprite.y);
      if (dist > 240 && (time - hunter.lastTeleportTime) > 20000) {
        if (hunter.type === "C") {
          this.triggerTeleportSequence(hunter, time);
          return;
        } else if (hunter.type === "M") {
          this.triggerSprintSequence(hunter, time);
          return;
        }
      }
    }
  }

  triggerSprintSequence(hunter, time) {
    this.teleporting = true; // Use this to pause active logic globally
    this.stopAllAgents();

    const sfx = this.sound.add("max_audio");
    sfx.once("complete", () => {
      this.teleporting = false;
      hunter.lastTeleportTime = this.time.now;
      hunter.isSprinting = true;
      hunter.decisionAt = this.time.now;
      this.playerAgent.moving = false;
      this.updatePlayerVisualState();

      // Unhook sprint after 4 seconds
      this.time.delayedCall(4000, () => {
        hunter.isSprinting = false;
      });
    });
    sfx.play();
  }

  triggerTeleportSequence(hunter, time) {
    this.teleporting = true;
    this.stopAllAgents();

    const origScale = hunter.sprite.scaleX;

    // 1. Vanish Animation
    this.tweens.add({
      targets: hunter.sprite,
      scale: 0,
      angle: 720,
      duration: 600,
      onComplete: () => {
        // 2. Play Audio 
        const sfx = this.sound.add("chin_audio");
        sfx.once("complete", () => {
          // 3. Move closer to player and Reappear
          const targetCell = this.findSafeCellNear(this.playerAgent.cellX, this.playerAgent.cellY, 3, 5);
          hunter.cellX = targetCell.x;
          hunter.cellY = targetCell.y;
          hunter.sprite.setPosition(this.gridToWorld(targetCell.x), this.gridToWorld(targetCell.y));
          hunter.direction = { x: 0, y: 0 };
          hunter.moving = false;

          this.tweens.add({
            targets: hunter.sprite,
            scale: origScale,
            angle: 0,
            duration: 300,
            onComplete: () => {
              this.teleporting = false;
              hunter.lastTeleportTime = this.time.now;
              hunter.decisionAt = this.time.now;
              this.playerAgent.moving = false; // Reset input momentum
              this.updatePlayerVisualState();
            }
          });
        });
        sfx.play();
      }
    });
  }

  findSafeCellNear(cx, cy, minR, maxR) {
    let validCells = [];
    for (let r = 0; r < this.gridHeight; r++) {
      for (let c = 0; c < this.gridWidth; c++) {
        if (!this.canMove(c, r)) continue;
        const dist = Math.abs(c - cx) + Math.abs(r - cy);
        if (dist >= minR && dist <= maxR) {
          validCells.push({ x: c, y: r });
        }
      }
    }
    if (validCells.length > 0) {
      return Phaser.Utils.Array.GetRandom(validCells);
    }
    return { x: cx, y: cy };
  }

  handlePlayerCaught() {
    if (this.invulnerable || this.transitioning || this.gameOver) return;

    this.lives -= 1;
    this.refreshHud();

    if (this.lives <= 0) {
      this.triggerGameOver();
      return;
    }

    this.invulnerable = true;
    this.nextDirection = { x: 0, y: 0 };
    this.resetPlayerToSpawn();
    this.resetHuntersToSpawn();

    this.tweens.add({
      targets: this.playerAgent.sprite,
      alpha: 0.2,
      duration: 100,
      yoyo: true,
      repeat: 7,
      onComplete: () => {
        this.playerAgent.sprite.setAlpha(1);
        this.invulnerable = false;
      },
    });
  }

  resetPlayerToSpawn() {
    const a = this.playerAgent;
    a.cellX = this.playerSpawnCell.x;
    a.cellY = this.playerSpawnCell.y;
    a.direction = { x: 0, y: 0 };
    a.moving = false;
    a.sprite.setPosition(this.gridToWorld(a.cellX), this.gridToWorld(a.cellY));
    this.updatePlayerVisualState();
  }

  resetHuntersToSpawn() {
    for (const h of this.hunters) {
      h.cellX = h.spawnCellX;
      h.cellY = h.spawnCellY;
      h.direction = { x: 0, y: 0 };
      h.moving = false;
      h.decisionAt = this.time.now + 300;
      h.sprite.setPosition(this.gridToWorld(h.cellX), this.gridToWorld(h.cellY));
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Level / Game state                                                 */
  /* ------------------------------------------------------------------ */

  levelComplete() {
    if (this.transitioning || this.gameOver) return;

    this.transitioning = true;
    this.stopAllAgents();
    this.updateHighScore(this.score);
    this.showNotice(`Level ${this.level} Cleared`);

    this.time.delayedCall(1200, () => {
      this.scene.restart({
        level: this.level + 1,
        score: this.score,
        highScore: this.highScore,
        lives: this.lives,
      });
    });
  }

  triggerGameOver() {
    this.gameOver = true;
    this.stopAllAgents();
    this.updateHighScore(this.score);

    // Transition to the unified Game Over scene instead of drawing it over the active level
    this.time.delayedCall(800, () => {
      this.scene.start("GameOverScene", {
        score: this.score,
        level: this.level,
        highScore: this.highScore
      });
    });
  }

  stopAllAgents() {
    const a = this.playerAgent;
    a.direction = { x: 0, y: 0 };
    a.moving = false;
    a.sprite.setPosition(this.gridToWorld(a.cellX), this.gridToWorld(a.cellY));
    this.updatePlayerVisualState();

    for (const h of this.hunters) {
      h.direction = { x: 0, y: 0 };
      h.moving = false;
      h.sprite.setPosition(this.gridToWorld(h.cellX), this.gridToWorld(h.cellY));
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Utility                                                            */
  /* ------------------------------------------------------------------ */

  showNotice(message) {
    this.noticeText.setText(message);
    this.noticeText.setVisible(true);
    this.noticeText.setAlpha(1);

    this.tweens.add({
      targets: this.noticeText,
      alpha: 0,
      duration: 1000,
      delay: 250,
      onComplete: () => this.noticeText.setVisible(false),
    });
  }

  gridToWorld(cell) {
    return cell * this.tileSize + this.tileSize / 2;
  }

  canMove(cellX, cellY) {
    if (cellX < 0 || cellY < 0 || cellX >= this.gridWidth || cellY >= this.gridHeight) {
      return false;
    }
    return this.levelLayout[cellY][cellX] !== "#";
  }

  findPathStep(start, goal) {
    if (start.x === goal.x && start.y === goal.y) return null;

    const queue = [{ x: start.x, y: start.y }];
    const visited = new Set([`${start.x},${start.y}`]);
    const cameFrom = new Map();
    const directions = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;
      if (current.x === goal.x && current.y === goal.y) break;

      for (const dir of directions) {
        const nx = current.x + dir.x;
        const ny = current.y + dir.y;
        const nk = `${nx},${ny}`;

        if (visited.has(nk) || !this.canMove(nx, ny)) continue;

        visited.add(nk);
        cameFrom.set(nk, { x: current.x, y: current.y });
        queue.push({ x: nx, y: ny });
      }
    }

    const goalKey = `${goal.x},${goal.y}`;
    if (!cameFrom.has(goalKey)) return null;

    let step = { x: goal.x, y: goal.y };
    let prev = cameFrom.get(`${step.x},${step.y}`);

    while (prev && !(prev.x === start.x && prev.y === start.y)) {
      step = prev;
      prev = cameFrom.get(`${step.x},${step.y}`);
    }

    return step;
  }

  refreshHud() {
    this.scoreText.setText(`Score: ${this.score}`);
    this.levelText.setText(`Level: ${this.level}`);

    this.livesIcons.forEach((icon, index) => {
      icon.setVisible(index < this.lives);
    });
  }

  readHighScore() {
    try {
      return Number(window.localStorage.getItem("pacMemeHighScore") || 0);
    } catch (error) {
      return 0;
    }
  }

  updateHighScore(nextScore) {
    if (nextScore <= this.highScore) return;

    this.highScore = nextScore;
    try {
      window.localStorage.setItem("pacMemeHighScore", String(this.highScore));
    } catch (error) {
      // Ignore storage failures.
    }
  }
}
