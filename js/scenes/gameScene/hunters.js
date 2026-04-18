GameScene.prototype.buildLevel = function buildLevel() {
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
      } else if (cell === "H" || cell === "K" || cell === "C" || cell === "M" || cell === "A" || cell === "D") {
        this.hunterSpawnCells.push({ x: col, y: row, type: cell });
      }
    }
  }

  if (this.hunterSpawnCells.length === 0) {
    this.hunterSpawnCells.push({ x: Math.floor(this.gridWidth / 2), y: Math.floor(this.gridHeight / 2), type: "H" });
  }

  this.drawTubularWalls();
  this.spawnParlegs();
};

GameScene.prototype.spawnParlegs = function spawnParlegs() {
  this.parlegSprites = [];
  this.parlegByCell = new Map();

  const parlegCount = this.level >= 4 ? 2 : 1;

  // Collect all open cells that aren't spawns
  const openCells = [];
  const spawnKeys = new Set();
  spawnKeys.add(`${this.playerSpawnCell.x},${this.playerSpawnCell.y}`);
  for (const s of this.hunterSpawnCells) {
    spawnKeys.add(`${s.x},${s.y}`);
  }

  for (let row = 0; row < this.gridHeight; row++) {
    for (let col = 0; col < this.gridWidth; col++) {
      const cell = this.levelLayout[row][col];
      if (cell === "." && !spawnKeys.has(`${col},${row}`)) {
        openCells.push({ x: col, y: row });
      }
    }
  }

  // Shuffle and pick cells spread apart
  Phaser.Utils.Array.Shuffle(openCells);
  const chosen = [];
  for (const c of openCells) {
    if (chosen.length >= parlegCount) break;
    // Ensure parlegs aren't too close to each other (min 5 cells apart)
    const tooClose = chosen.some(
      (p) => Math.abs(p.x - c.x) + Math.abs(p.y - c.y) < 5
    );
    if (tooClose) continue;
    chosen.push(c);
  }

  for (const pos of chosen) {
    const wx = this.gridToWorld(pos.x);
    const wy = this.gridToWorldY(pos.y);
    const sprite = this.add.image(wx, wy, "parleg").setDepth(3);
    sprite.setDisplaySize(this.tileSize - 4, this.tileSize - 4);

    // Gentle floating animation
    this.tweens.add({
      targets: sprite,
      y: wy - 4,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    const key = `${pos.x},${pos.y}`;
    this.parlegByCell.set(key, sprite);
    this.parlegSprites.push(sprite);

    // Remove the pellet at this cell since parleg replaces it
    const pellet = this.pelletByCell.get(key);
    if (pellet) {
      pellet.destroy();
      this.pelletByCell.delete(key);
    }
  }
};

GameScene.prototype.drawTubularWalls = function drawTubularWalls() {
  const gfx = this.add.graphics().setDepth(1);

  gfx.fillStyle(0x0000ff, 1);
  this.drawTubes(gfx, 4, 8);

  gfx.fillStyle(0x0f172a, 1);
  this.drawTubes(gfx, 8, 4);
};

GameScene.prototype.drawTubes = function drawTubes(gfx, margin, cornerRadius) {
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
};

GameScene.prototype.createActors = function createActors() {
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
    } else if (spawn.type === "D") {
      spriteKey = "mahi_hunter";
    }

    const sprite = this.add.sprite(sx, sy, spriteKey).setDepth(4);

    if (spriteKey === "chin_tapak") {
      sprite.setDisplaySize(52, 52);
    } else if (spriteKey === "max_hunter") {
      sprite.setDisplaySize(42, 42);
    } else if (spriteKey === "amitabh_aag") {
      sprite.setDisplaySize(64, 36);
    } else if (spriteKey === "mahi_hunter") {
      sprite.setDisplaySize(52, 52);
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
      isPhasing: false,
      phaseAudio: null,
      baseScaleX: sprite.scaleX,
      baseScaleY: sprite.scaleY,
      specialCooldown: (function () {
        if (this.level === 5) {
          if (spawn.type === "D") return 6000;
          if (spawn.type === "A") return 1500;
          return 19000;
        }
        if (this.level === 3) {
          if (spawn.type === "A") return 1800;
        }
        if (this.level === 4) {
          if (spawn.type === "A") return 1800;
          if (spawn.type === "C") return 12000;
        }
        return spawn.type === "A" ? 2500 : (spawn.type === "D" ? 7000 : 20000);
      }).call(this),
    };
  });
};

GameScene.prototype.checkHunterContact = function checkHunterContact() {
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
};

GameScene.prototype.checkSpecialTriggers = function checkSpecialTriggers(time) {
  if (this.transitioning || this.gameOver || this.invulnerable) return;

  const globalGapReady = (time - this.lastAnySpecialAt) >= this.minSpecialGapMs;

  for (const hunter of this.hunters) {
    if (hunter.isSprinting || hunter.isTeleporting || hunter.isPhasing) continue;

    // On Level 5 Mahi bypasses the global cooldown; everyone else must wait
    if (!globalGapReady && !(this.level === 5 && hunter.type === "D")) continue;

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

    if (hunter.type === "D") {
      const throwDirection = this.getFireDirection(hunter);
      if (
        throwDirection
        && dist > this.tileSize * 2.5
        && (time - hunter.lastSpecialTime) > hunter.specialCooldown
      ) {
        this.triggerMahiThrowSequence(hunter, throwDirection, time);
        return;
      }

      if (dist > this.tileSize * 4 && (time - hunter.lastSpecialTime) > hunter.specialCooldown) {
        this.triggerMahiPhasingSequence(hunter, time);
        return;
      }

      continue;
    }

    const triggerDist = (this.level === 4 && hunter.type === "C") ? 160 : 240;
    if (dist > triggerDist && (time - hunter.lastSpecialTime) > hunter.specialCooldown) {
      if (hunter.type === "C") {
        this.triggerTeleportSequence(hunter, time);
        return;
      } else if (hunter.type === "M") {
        this.triggerSprintSequence(hunter, time);
        return;
      }
    }
  }
};

GameScene.prototype.triggerSprintSequence = function triggerSprintSequence(hunter, time) {
  hunter.lastSpecialTime = time;
  this.lastAnySpecialAt = time;
  hunter.direction = { x: 0, y: 0 };
  hunter.moving = false;
  hunter.sprite.setPosition(this.gridToWorld(hunter.cellX), this.gridToWorldY(hunter.cellY));
  hunter.decisionAt = time + 120;

  hunter.isSprinting = true;
  hunter.decisionAt = this.time.now;

  const sfx = this.sound.add("max_audio");
  sfx.once("complete", () => {
    if (!hunter.sprite.active) return;
    sfx.destroy();
  });
  sfx.play();

  this.time.delayedCall(4000, () => {
    if (!hunter.sprite.active) return;
    hunter.isSprinting = false;
  });
};

GameScene.prototype.triggerTeleportSequence = function triggerTeleportSequence(hunter, time) {
  hunter.lastSpecialTime = time;
  this.lastAnySpecialAt = time;
  hunter.isTeleporting = true;
  hunter.direction = { x: 0, y: 0 };
  hunter.moving = false;
  this.tweens.killTweensOf(hunter.sprite);

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
};

GameScene.prototype.triggerFireSequence = function triggerFireSequence(hunter, direction, time) {
  hunter.lastSpecialTime = time;
  this.lastAnySpecialAt = time;
  hunter.direction = { x: 0, y: 0 };
  hunter.moving = false;
  hunter.sprite.setPosition(this.gridToWorld(hunter.cellX), this.gridToWorldY(hunter.cellY));
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
};

GameScene.prototype.triggerMahiThrowSequence = function triggerMahiThrowSequence(hunter, direction, time) {
  hunter.lastSpecialTime = time;
  if (this.level !== 5) this.lastAnySpecialAt = time;
  hunter.direction = { x: 0, y: 0 };
  hunter.moving = false;
  hunter.sprite.setPosition(this.gridToWorld(hunter.cellX), this.gridToWorldY(hunter.cellY));
  hunter.decisionAt = time + 220;

  this.sound.play("mahi_throw_audio");
  this.spawnCricketBallProjectile(hunter, direction);

  this.tweens.add({
    targets: hunter.sprite,
    scaleX: hunter.baseScaleX * 1.1,
    scaleY: hunter.baseScaleY * 1.1,
    duration: 100,
    yoyo: true,
    onComplete: () => {
      hunter.sprite.setScale(hunter.baseScaleX, hunter.baseScaleY);
    },
  });
};

GameScene.prototype.triggerMahiPhasingSequence = function triggerMahiPhasingSequence(hunter, time) {
  hunter.lastSpecialTime = time;
  if (this.level !== 5) this.lastAnySpecialAt = time;
  hunter.isPhasing = true;
  hunter.direction = { x: 0, y: 0 };
  hunter.moving = false;
  hunter.sprite.setPosition(this.gridToWorld(hunter.cellX), this.gridToWorldY(hunter.cellY));
  hunter.decisionAt = this.time.now;

  this.stopHunterPhaseAudio(hunter);
  hunter.phaseAudio = this.sound.add("mahi_phase_audio", { loop: true, volume: 0.6 });
  hunter.phaseAudio.play();

  this.tweens.add({
    targets: hunter.sprite,
    alpha: 0.55,
    duration: 220,
    yoyo: true,
    repeat: 7,
  });

  this.time.delayedCall(4200, () => {
    if (!hunter.sprite.active) return;
    hunter.isPhasing = false;
    hunter.sprite.setAlpha(1);
    this.stopHunterPhaseAudio(hunter);

    // Safety: if stuck inside a wall after phasing ends, snap to nearest open cell
    if (this.levelLayout[hunter.cellY]?.[hunter.cellX] === "#") {
      const safe = this.findNearestOpenCell(hunter.cellX, hunter.cellY);
      if (safe) {
        hunter.cellX = safe.x;
        hunter.cellY = safe.y;
        hunter.direction = { x: 0, y: 0 };
        hunter.moving = false;
        hunter.sprite.setPosition(this.gridToWorld(safe.x), this.gridToWorldY(safe.y));
      }
    }
  });
};

GameScene.prototype.findSafeCellNear = function findSafeCellNear(cx, cy, minR, maxR) {
  const validCells = [];
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
};

GameScene.prototype.stopHunterPhaseAudio = function stopHunterPhaseAudio(hunter) {
  if (!hunter.phaseAudio) return;

  if (hunter.phaseAudio.isPlaying) {
    hunter.phaseAudio.stop();
  }
  hunter.phaseAudio.destroy();
  hunter.phaseAudio = null;
};

GameScene.prototype.findPathStep = function findPathStep(start, goal, hunter) {
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

      if (visited.has(nk) || !this.canHunterMove(hunter, nx, ny)) continue;

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
};

GameScene.prototype.triggerSixtySevenMeme = function triggerSixtySevenMeme() {
  if (!this.scoreText) return;

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
      const progress = tween.getValue();
      if (progress > 0.5) animText.setColor("#ef4444");
    },
    onComplete: () => {
      animText.destroy();
    }
  });

  this._spawnSixtySevenVideos();
};

GameScene.prototype._spawnSixtySevenVideos = function _spawnSixtySevenVideos() {
  this.removeSixtySevenMeme();

  const canvas = this.sys.game.canvas;
  const rect = canvas.getBoundingClientRect();

  const vidW = Math.round(rect.width * 0.35);
  const vidH = Math.round(vidW * (9 / 16));
  const cy = Math.round(rect.top + (rect.height - vidH) / 2);

  const positions = [
    rect.left - vidW - 5,
    rect.right + 5
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
};

GameScene.prototype.removeSixtySevenMeme = function removeSixtySevenMeme() {
  if (this._sixtySevenVideos) {
    this._sixtySevenVideos.forEach(vid => {
      vid.pause();
      vid.remove();
    });
    this._sixtySevenVideos = [];
  }
};

/**
 * BFS outward from (cx, cy) to find the nearest non-wall cell.
 * Used as a safety net when a hunter ends phasing inside a wall.
 */
GameScene.prototype.findNearestOpenCell = function findNearestOpenCell(cx, cy) {
  const queue = [{ x: cx, y: cy }];
  const visited = new Set([`${cx},${cy}`]);
  const dirs = [
    { x: 1, y: 0 }, { x: -1, y: 0 },
    { x: 0, y: 1 }, { x: 0, y: -1 },
  ];

  while (queue.length > 0) {
    const cur = queue.shift();
    if (this.levelLayout[cur.y]?.[cur.x] !== "#") {
      return cur;
    }
    for (const d of dirs) {
      const nx = cur.x + d.x;
      const ny = cur.y + d.y;
      const nk = `${nx},${ny}`;
      if (visited.has(nk)) continue;
      if (nx < 0 || ny < 0 || nx >= this.gridWidth || ny >= this.gridHeight) continue;
      visited.add(nk);
      queue.push({ x: nx, y: ny });
    }
  }
  return null;
};
