class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
    this.tileSize = 34;
    this.gridWidth = 0;
    this.gridHeight = 0;
    this.boardOffsetX = 0;
    this.boardOffsetY = 0;
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
    this.fireProjectiles = [];
    this.nextDirection = { x: 0, y: 0 };
    this.playerSoundEnabled = true;
    this.playerAudioPlayCount = 0;
    this.playerAudioReplayTimer = null;
    this.lastAnySpecialAt = -5000;
    this.minSpecialGapMs = 5000;
    this.minAagTriggerDistanceTiles = 3.5;
    this._sixtySevenVideos = [];
  }

  create() {
    this.cursors = this.input.keyboard.createCursorKeys();

    this.levelLayout = window.GameLevels[this.level] || window.GameLevels[1];
    // Higher levels → shorter gap between hunter specials
    if (this.level >= 4) {
      this.minSpecialGapMs = 1500;
    } else if (this.level >= 2) {
      this.minSpecialGapMs = 3000;
    }
    this.gridHeight = this.levelLayout.length;
    this.gridWidth = this.levelLayout[0]?.length || 0;

    const playfieldWidth = this.gridWidth * this.tileSize;
    const playfieldHeight = this.gridHeight * this.tileSize;
    const hudHeight = 78;

    this.boardOffsetX = Math.floor((this.scale.width - playfieldWidth) / 2);
    this.boardOffsetY = Math.max(10, Math.floor((this.scale.height - hudHeight - playfieldHeight) / 2));

    this.pelletByCell = new Map();
    this.playerSpawnCell = { x: 7, y: 7 };
    this.hunterSpawnCells = [];

    this.buildLevel();
    this.createActors();
    this.createHud();
    this.initPlayerAudio();
    this.events.once("shutdown", this.shutdownGameScene, this);
    this.events.once("destroy", this.shutdownGameScene, this);

    // Remove pellet under the player at start
    this.collectPelletAt(this.playerAgent.cellX, this.playerAgent.cellY);
  }

  initPlayerAudio() {
    this.playerAudio = this.sound.add("player_audio", {
      volume: 0.25,
    });

    this.events.once("shutdown", this.teardownPlayerAudio, this);
    this.events.once("destroy", this.teardownPlayerAudio, this);
  }

  teardownPlayerAudio() {
    if (!this.playerAudio) return;

    if (this.playerAudioReplayTimer) {
      this.playerAudioReplayTimer.remove(false);
      this.playerAudioReplayTimer = null;
    }

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

    if (this.transitioning) return;

    this.readPlayerInput();
    this.movePlayer(delta);
    this.checkSpecialTriggers(time);
    this.moveHunters(delta, time);
    this.updateFireProjectiles(delta);
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
        const wy = this.gridToWorldY(row);

        if (cell === "#") {
          // Walls are drawn later mathematically
        } else if (cell === ".") {
          const pellet = this.add.image(wx, wy, "pellet").setDepth(2);
          this.pelletByCell.set(`${col},${row}`, pellet);
        } else if (cell === "P") {
          this.playerSpawnCell = { x: col, y: row };
        } else if (cell === "H" || cell === "K" || cell === "C" || cell === "M" || cell === "A") {
          this.hunterSpawnCells.push({ x: col, y: row, type: cell });
        }
      }
    }

    if (this.hunterSpawnCells.length === 0) {
      this.hunterSpawnCells.push({ x: Math.floor(this.gridWidth / 2), y: Math.floor(this.gridHeight / 2), type: "H" });
    }

    this.drawTubularWalls();
  }

  drawTubularWalls() {
    const gfx = this.add.graphics().setDepth(1);

    // Outer thick classic blue tubes (from reference)
    gfx.fillStyle(0x0000ff, 1);
    this.drawTubes(gfx, 4, 8);

    // Inner hollow tubes (matching background)
    gfx.fillStyle(0x0f172a, 1);
    this.drawTubes(gfx, 8, 4);
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

        const ox = this.boardOffsetX + x;
        const oy = this.boardOffsetY + y;

        gfx.fillRoundedRect(ox + margin, oy + margin, size, size, cornerRadius);

        const half = ts / 2;
        if (isW(col, row - 1)) gfx.fillRect(ox + margin, oy, size, half);
        if (isW(col, row + 1)) gfx.fillRect(ox + margin, oy + half, size, half);
        if (isW(col - 1, row)) gfx.fillRect(ox, oy + margin, half, size);
        if (isW(col + 1, row)) gfx.fillRect(ox + half, oy + margin, half, size);
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Actor creation                                                     */
  /* ------------------------------------------------------------------ */

  createActors() {
    const px = this.gridToWorld(this.playerSpawnCell.x);
    const py = this.gridToWorldY(this.playerSpawnCell.y);

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
      const sy = this.gridToWorldY(spawn.y);

      let spriteKey = "hunter";
      if (spawn.type === "C") {
        spriteKey = "chin_tapak";
      } else if (spawn.type === "M") {
        spriteKey = "max_hunter";
      } else if (spawn.type === "A") {
        spriteKey = "amitabh_aag";
      }

      const sprite = this.add.sprite(sx, sy, spriteKey).setDepth(4);

      if (spriteKey === "chin_tapak") {
        sprite.setDisplaySize(52, 52);
      } else if (spriteKey === "max_hunter") {
        sprite.setDisplaySize(42, 42);
      } else if (spriteKey === "amitabh_aag") {
        sprite.setDisplaySize(64, 36);
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
        lastSpecialTime: -30000,
        isSprinting: false,
        isTeleporting: false,
        baseScaleX: sprite.scaleX,
        baseScaleY: sprite.scaleY,
        specialCooldown: spawn.type === "A" ? 2500 : 20000,
      };
    });
  }

  /* ------------------------------------------------------------------ */
  /*  HUD                                                                */
  /* ------------------------------------------------------------------ */

  createHud() {
    this.hudStyle = {
      fontFamily: 'PacFont',
      fontSize: "20px",
      color: "#e2e8f0",
      stroke: "#020617",
      strokeThickness: 4,
    };

    const hudY = this.scale.height - 40;
    this.scoreText = this.add.text(this.boardOffsetX, hudY, "", this.hudStyle).setDepth(6);
    this.levelText = this.add.text(this.scale.width / 2 - 48, hudY, "", this.hudStyle).setDepth(6);

    this.livesIcons = [];
    const livesStartX = this.boardOffsetX + this.gridWidth * this.tileSize - 120;
    for (let i = 0; i < 3; i++) {
      const heart = this.add.image(livesStartX + i * 40, hudY + 13, "heart").setDepth(6);
      this.livesIcons.push(heart);
    }

    const centerY = this.boardOffsetY + (this.gridHeight * this.tileSize) / 2;
    this.noticeText = this.add
      .text(this.scale.width / 2, centerY, "", {
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
      sprite.setDisplaySize(this.tileSize + 35, this.tileSize + 35);
      if (!sprite.anims.isPlaying || sprite.anims.currentAnim?.key !== "player-run") {
        sprite.play("player-run", true);
      }
      this.updatePlayerAudioState();
      return;
    }

    sprite.setDisplaySize(this.tileSize + 15, this.tileSize + 15);
    if (sprite.anims.isPlaying) {
      sprite.stop();
    }
    if (sprite.texture.key !== "player_idle") {
      sprite.setTexture("player_idle");
    }

    this.updatePlayerAudioState();
  }

  updatePlayerAudioState() {
    if (!this.playerAudio) return;

    if (!this.playerSoundEnabled) {
      this.stopPlayerAudio();
      return;
    }

    if (!this.playerAgent.moving) {
      this.stopPlayerAudio();
      return;
    }

    if (this.playerAudio.isPlaying || this.playerAudioReplayTimer) return;

    this.playPlayerAudio();
  }

  playPlayerAudio() {
    if (!this.playerAudio || !this.playerAgent?.moving) return;

    this.playerAudio.play();

    this.playerAudio.once("complete", () => {
      if (!this.playerAudio || !this.playerAgent?.moving || !this.playerSoundEnabled) return;

      this.playerAudioReplayTimer = this.time.delayedCall(1000, () => {
        this.playerAudioReplayTimer = null;
        if (this.playerAgent?.moving && this.playerSoundEnabled) {
          this.playPlayerAudio();
        }
      });
    });
  }

  stopPlayerAudio() {
    if (this.playerAudioReplayTimer) {
      this.playerAudioReplayTimer.remove(false);
      this.playerAudioReplayTimer = null;
    }

    if (this.playerAudio?.isPlaying) {
      this.playerAudio.stop();
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Hunter movement                                                    */
  /* ------------------------------------------------------------------ */

  moveHunters(delta, time) {
    for (const hunter of this.hunters) {
      if (hunter.isTeleporting) continue;

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

  updateFireProjectiles(delta) {
    if (this.fireProjectiles.length === 0) return;

    const remaining = [];

    for (const projectile of this.fireProjectiles) {
      if (!projectile.sprite.active) {
        continue;
      }

      const move = projectile.speed * (delta / 1000);
      projectile.sprite.x += projectile.direction.x * move;
      projectile.sprite.y += projectile.direction.y * move;

      const cellX = this.worldToCell(projectile.sprite.x, this.boardOffsetX);
      const cellY = this.worldToCell(projectile.sprite.y, this.boardOffsetY);
      if (!this.canMove(cellX, cellY)) {
        projectile.sprite.destroy();
        continue;
      }

      const dist = Phaser.Math.Distance.Between(
        this.playerAgent.sprite.x,
        this.playerAgent.sprite.y,
        projectile.sprite.x,
        projectile.sprite.y
      );
      if (!this.invulnerable && dist < this.tileSize * 0.55) {
        projectile.sprite.destroy();
        this.handlePlayerCaught();
        return;
      }

      remaining.push(projectile);
    }

    this.fireProjectiles = remaining;
  }

  /* ------------------------------------------------------------------ */
  /*  Shared movement helper – moves sprite towards the next cell        */
  /* ------------------------------------------------------------------ */

  advanceAgent(agent, delta, speedOverride) {
    const speed = speedOverride || agent.speed;
    const move = speed * (delta / 1000);

    const targetX = this.gridToWorld(agent.cellX + agent.direction.x);
    const targetY = this.gridToWorldY(agent.cellY + agent.direction.y);

    const dx = targetX - agent.sprite.x;
    const dy = targetY - agent.sprite.y;
    const dist = Math.abs(dx) + Math.abs(dy);

    if (dist <= move + 0.1) {
      // Arrived at next cell
      agent.cellX += agent.direction.x;
      agent.cellY += agent.direction.y;
      agent.sprite.setPosition(
        this.gridToWorld(agent.cellX),
        this.gridToWorldY(agent.cellY)
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

    if (this.score % 100 === 67) {
      this.triggerSixtySevenMeme();
    }

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
      if (hunter.isTeleporting) continue;

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
    if (this.transitioning || this.gameOver || this.invulnerable) return;
    if ((time - this.lastAnySpecialAt) < this.minSpecialGapMs) return;

    for (const hunter of this.hunters) {
      if (hunter.isSprinting || hunter.isTeleporting) continue;

      const dist = Phaser.Math.Distance.Between(
        hunter.sprite.x,
        hunter.sprite.y,
        this.playerAgent.sprite.x,
        this.playerAgent.sprite.y
      );

      if (hunter.type === "A") {
        const fireDirection = this.getFireDirection(hunter);
        if (
          dist > this.tileSize * this.minAagTriggerDistanceTiles
          && fireDirection
          && (time - hunter.lastSpecialTime) > hunter.specialCooldown
        ) {
          this.triggerFireSequence(hunter, fireDirection, time);
          return;
        }
        continue;
      }

      if (dist > 240 && (time - hunter.lastSpecialTime) > hunter.specialCooldown) {
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
    hunter.lastSpecialTime = time;
    this.lastAnySpecialAt = time;
    hunter.direction = { x: 0, y: 0 };
    hunter.moving = false;
    hunter.decisionAt = time + 120;

    const sfx = this.sound.add("max_audio");
    sfx.once("complete", () => {
      if (!hunter.sprite.active || this.transitioning || this.gameOver) return;

      hunter.isSprinting = true;
      hunter.decisionAt = this.time.now;

      this.time.delayedCall(4000, () => {
        if (!hunter.sprite.active) return;
        hunter.isSprinting = false;
      });

      sfx.destroy();
    });
    sfx.play();
  }

  triggerTeleportSequence(hunter, time) {
    hunter.lastSpecialTime = time;
    this.lastAnySpecialAt = time;
    hunter.isTeleporting = true;
    hunter.direction = { x: 0, y: 0 };
    hunter.moving = false;
    this.tweens.killTweensOf(hunter.sprite);

    // 1. Vanish Animation
    this.tweens.add({
      targets: hunter.sprite,
      scaleX: 0,
      scaleY: 0,
      angle: 720,
      duration: 600,
      onComplete: () => {
        if (!hunter.sprite.active || !hunter.isTeleporting || this.transitioning || this.gameOver) return;

        const targetCell = this.findSafeCellNear(this.playerAgent.cellX, this.playerAgent.cellY, 3, 5);
        hunter.cellX = targetCell.x;
        hunter.cellY = targetCell.y;
        hunter.sprite
          .setPosition(this.gridToWorld(targetCell.x), this.gridToWorldY(targetCell.y))
          .setVisible(true)
          .setScale(0, 0);

        this.sound.play("chin_audio");

        this.tweens.add({
          targets: hunter.sprite,
          scaleX: hunter.baseScaleX,
          scaleY: hunter.baseScaleY,
          angle: 0,
          duration: 900,
          onComplete: () => {
            hunter.decisionAt = this.time.now;
            hunter.isTeleporting = false;
          },
        });
      },
    });
  }

  triggerFireSequence(hunter, direction, time) {
    hunter.lastSpecialTime = time;
    this.lastAnySpecialAt = time;
    hunter.direction = { x: 0, y: 0 };
    hunter.moving = false;
    hunter.decisionAt = time + 260;

    this.sound.play("aag_audio");
    this.spawnFireProjectile(hunter, direction);

    this.tweens.add({
      targets: hunter.sprite,
      scaleX: hunter.baseScaleX * 1.08,
      scaleY: hunter.baseScaleY * 1.08,
      duration: 90,
      yoyo: true,
      onComplete: () => {
        hunter.sprite.setScale(hunter.baseScaleX, hunter.baseScaleY);
      },
    });
  }

  spawnFireProjectile(hunter, direction) {
    const projectile = this.add.sprite(
      hunter.sprite.x + direction.x * (this.tileSize * 0.7),
      hunter.sprite.y + direction.y * (this.tileSize * 0.7),
      "fire_projectile"
    ).setDepth(5);

    projectile.setDisplaySize(32, 42);
    projectile.setAngle(this.getDirectionAngle(direction));
    projectile.play("fire-burn");

    this.fireProjectiles.push({
      sprite: projectile,
      direction: { ...direction },
      speed: 260,
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

    this.clearFireProjectiles();
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
    a.sprite.setPosition(this.gridToWorld(a.cellX), this.gridToWorldY(a.cellY));
    this.updatePlayerVisualState();
  }

  resetHuntersToSpawn() {
    for (const h of this.hunters) {
      h.cellX = h.spawnCellX;
      h.cellY = h.spawnCellY;
      h.direction = { x: 0, y: 0 };
      h.moving = false;
      h.isSprinting = false;
      h.isTeleporting = false;
      h.decisionAt = this.time.now + 300;
      this.tweens.killTweensOf(h.sprite);
      h.sprite
        .setPosition(this.gridToWorld(h.cellX), this.gridToWorldY(h.cellY))
        .setScale(h.baseScaleX, h.baseScaleY)
        .setAngle(0)
        .setVisible(true);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Level / Game state                                                 */
  /* ------------------------------------------------------------------ */

  levelComplete() {
    if (this.transitioning || this.gameOver) return;

    this.transitioning = true;
    this.stopAllAgents();
    this.sound.stopAll();
    this.updateHighScore(this.score);
    this.showNotice(`Level ${this.level} Cleared`);

    this.time.delayedCall(1200, () => {
      this.scene.start("LevelClearedScene", {
        level: this.level,
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
    this.sound.stopAll();

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
    a.sprite.setPosition(this.gridToWorld(a.cellX), this.gridToWorldY(a.cellY));
    this.updatePlayerVisualState();
    this.clearFireProjectiles();
    this.removeSixtySevenMeme();

    for (const h of this.hunters) {
      h.direction = { x: 0, y: 0 };
      h.moving = false;
      h.isSprinting = false;
      h.isTeleporting = false;
      this.tweens.killTweensOf(h.sprite);
      h.sprite.setPosition(this.gridToWorld(h.cellX), this.gridToWorldY(h.cellY));
      h.sprite.setScale(h.baseScaleX, h.baseScaleY).setAngle(0).setVisible(true);
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
    return this.boardOffsetX + cell * this.tileSize + this.tileSize / 2;
  }

  gridToWorldY(cell) {
    return this.boardOffsetY + cell * this.tileSize + this.tileSize / 2;
  }

  worldToCell(worldPos, offset) {
    return Math.floor((worldPos - offset) / this.tileSize);
  }

  canMove(cellX, cellY) {
    if (cellX < 0 || cellY < 0 || cellX >= this.gridWidth || cellY >= this.gridHeight) {
      return false;
    }
    return this.levelLayout[cellY][cellX] !== "#";
  }

  getFireDirection(hunter) {
    const player = this.playerAgent;
    if (hunter.cellY === player.cellY) {
      const step = player.cellX > hunter.cellX ? 1 : -1;
      if (this.hasLineOfSight(hunter.cellX, hunter.cellY, player.cellX, player.cellY, step, 0)) {
        return { x: step, y: 0 };
      }
    }

    if (hunter.cellX === player.cellX) {
      const step = player.cellY > hunter.cellY ? 1 : -1;
      if (this.hasLineOfSight(hunter.cellX, hunter.cellY, player.cellX, player.cellY, 0, step)) {
        return { x: 0, y: step };
      }
    }

    return null;
  }

  hasLineOfSight(fromX, fromY, toX, toY, stepX, stepY) {
    let cellX = fromX + stepX;
    let cellY = fromY + stepY;

    while (!(cellX === toX && cellY === toY)) {
      if (!this.canMove(cellX, cellY)) {
        return false;
      }

      cellX += stepX;
      cellY += stepY;
    }

    return true;
  }

  getDirectionAngle(direction) {
    if (direction.x > 0) return 90;
    if (direction.x < 0) return -90;
    if (direction.y > 0) return 180;
    return 0;
  }

  clearFireProjectiles() {
    for (const projectile of this.fireProjectiles) {
      if (projectile.sprite?.active) {
        projectile.sprite.destroy();
      }
    }
    this.fireProjectiles = [];
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

  /* ------------------------------------------------------------------ */
  /*  67 Meme Logic                                                      */
  /* ------------------------------------------------------------------ */

  triggerSixtySevenMeme() {
    if (!this.scoreText) return;

    // 1. Text Animation
    const animText = this.add.text(this.scoreText.x, this.scoreText.y, "67", {
      fontFamily: 'PacFont',
      fontSize: "24px",
      color: "#facc15"
    }).setOrigin(0, 0).setDepth(20);

    this.tweens.add({
      targets: animText,
      y: animText.y - 60,
      scaleX: 2.5,
      scaleY: 2.5,
      duration: 1500,
      ease: "Power2",
      onUpdate: (tween) => {
        // Transition color towards red during tween
        const progress = tween.getValue();
        if (progress > 0.5) animText.setColor("#ef4444");
      },
      onComplete: () => {
        animText.destroy();
      }
    });

    // 2. Play Videos
    this._spawnSixtySevenVideos();
  }

  _spawnSixtySevenVideos() {
    this.removeSixtySevenMeme(); // Purge old ones if overlapping

    const canvas = this.sys.game.canvas;
    const rect = canvas.getBoundingClientRect();

    const vidW = Math.round(rect.width * 0.35); // 35% of grid width
    const vidH = Math.round(vidW * (9 / 16));
    const cy = Math.round(rect.top + (rect.height - vidH) / 2);

    const positions = [
      rect.left - vidW - 5, // Left of board
      rect.right + 5        // Right of board
    ];

    positions.forEach(xPos => {
      const vid = document.createElement("video");
      vid.src = "assets/nub-nub-cat-67.mp4";
      vid.autoplay = true;
      vid.muted = false;
      vid.playsInline = true;
      vid.style.position = "fixed";
      vid.style.left = xPos + "px";
      vid.style.top = cy + "px";
      vid.style.width = vidW + "px";
      vid.style.height = vidH + "px";
      vid.style.zIndex = "9999";
      vid.style.borderRadius = "8px";
      vid.style.boxShadow = "0 0 15px rgba(239, 68, 68, 0.6)";
      vid.style.objectFit = "cover";

      let loopCount = 0;
      const maxLoops = 5;

      vid.onended = () => {
        loopCount++;
        if (loopCount < maxLoops) {
          vid.play();
        } else {
          vid.remove();
        }
      };

      document.body.appendChild(vid);
      this._sixtySevenVideos.push(vid);
    });
  }

  removeSixtySevenMeme() {
    if (this._sixtySevenVideos) {
      this._sixtySevenVideos.forEach(vid => {
        vid.pause();
        vid.remove();
      });
      this._sixtySevenVideos = [];
    }
  }

  shutdownGameScene() {
    this.clearFireProjectiles();
    this.removeSixtySevenMeme();
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
