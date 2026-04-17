GameScene.prototype.readPlayerInput = function readPlayerInput() {
  if (this.cursors.left.isDown) this.nextDirection = { x: -1, y: 0 };
  else if (this.cursors.right.isDown) this.nextDirection = { x: 1, y: 0 };
  else if (this.cursors.up.isDown) this.nextDirection = { x: 0, y: -1 };
  else if (this.cursors.down.isDown) this.nextDirection = { x: 0, y: 1 };
};

GameScene.prototype.movePlayer = function movePlayer(delta) {
  const agent = this.playerAgent;

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

  if (agent.moving) {
    this.advanceAgent(agent, delta);
    if (!agent.moving) {
      this.collectPelletAt(agent.cellX, agent.cellY);
    }
  }

  if (!agent.moving) {
    if (this.canMove(agent.cellX + this.nextDirection.x, agent.cellY + this.nextDirection.y)) {
      agent.direction = { ...this.nextDirection };
    }
    if (!this.canMove(agent.cellX + agent.direction.x, agent.cellY + agent.direction.y)) {
      agent.direction = { x: 0, y: 0 };
    }
    if (agent.direction.x !== 0 || agent.direction.y !== 0) {
      agent.moving = true;
    }
  }

  this.updatePlayerVisualState();
};

GameScene.prototype.updatePlayerVisualState = function updatePlayerVisualState() {
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
};

GameScene.prototype.updatePlayerAudioState = function updatePlayerAudioState() {
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
};

GameScene.prototype.playPlayerAudio = function playPlayerAudio() {
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
};

GameScene.prototype.stopPlayerAudio = function stopPlayerAudio() {
  if (this.playerAudioReplayTimer) {
    this.playerAudioReplayTimer.remove(false);
    this.playerAudioReplayTimer = null;
  }

  if (this.playerAudio?.isPlaying) {
    this.playerAudio.stop();
  }
};

GameScene.prototype.moveHunters = function moveHunters(delta, time) {
  for (const hunter of this.hunters) {
    if (hunter.isTeleporting) continue;

    if (!hunter.moving) {
      if (time >= hunter.decisionAt) {
        if (this.shouldChasePlayer(hunter)) {
          const start = { x: hunter.cellX, y: hunter.cellY };
          const goal = { x: this.playerAgent.cellX, y: this.playerAgent.cellY };
          const nextStep = this.findPathStep(start, goal, hunter);

          if (nextStep) {
            hunter.direction = {
              x: nextStep.x - start.x,
              y: nextStep.y - start.y,
            };
          }
        } else {
          this.pickWanderDirection(hunter);
        }

        hunter.decisionAt = time + Phaser.Math.Between(120, 220);
      }

      if (!this.canHunterMove(hunter, hunter.cellX + hunter.direction.x, hunter.cellY + hunter.direction.y)) {
        const dirs = [
          { x: 1, y: 0 },
          { x: -1, y: 0 },
          { x: 0, y: 1 },
          { x: 0, y: -1 },
        ].filter((d) => this.canHunterMove(hunter, hunter.cellX + d.x, hunter.cellY + d.y));

        hunter.direction = dirs.length > 0 ? Phaser.Utils.Array.GetRandom(dirs) : { x: 0, y: 0 };
      }

      if (hunter.direction.x !== 0 || hunter.direction.y !== 0) {
        hunter.moving = true;
      }
    }

    if (hunter.moving) {
      const levelBoost = (this.level - 1) * 8;
      let speed = Phaser.Math.Clamp(hunter.speed + levelBoost, 95, 250);
      if (hunter.isSprinting) {
        speed = 180;
      } else if (hunter.isPhasing) {
        speed = Math.max(80, speed * 0.72);
      }
      this.advanceAgent(hunter, delta, speed);

      // Safety: if a non-phasing hunter somehow ended up in a wall, rescue it
      if (!hunter.moving && !hunter.isPhasing &&
          this.levelLayout[hunter.cellY]?.[hunter.cellX] === "#") {
        const safe = this.findNearestOpenCell(hunter.cellX, hunter.cellY);
        if (safe) {
          hunter.cellX = safe.x;
          hunter.cellY = safe.y;
          hunter.direction = { x: 0, y: 0 };
          hunter.sprite.setPosition(this.gridToWorld(safe.x), this.gridToWorldY(safe.y));
        }
      }
    }
  }
};

GameScene.prototype.advanceAgent = function advanceAgent(agent, delta, speedOverride) {
  const speed = speedOverride || agent.speed;
  const move = speed * (delta / 1000);

  const targetX = this.gridToWorld(agent.cellX + agent.direction.x);
  const targetY = this.gridToWorldY(agent.cellY + agent.direction.y);

  const dx = targetX - agent.sprite.x;
  const dy = targetY - agent.sprite.y;
  const dist = Math.abs(dx) + Math.abs(dy);

  if (dist <= move + 0.1) {
    agent.cellX += agent.direction.x;
    agent.cellY += agent.direction.y;
    agent.sprite.setPosition(this.gridToWorld(agent.cellX), this.gridToWorldY(agent.cellY));
    agent.moving = false;
  } else {
    agent.sprite.x += agent.direction.x * move;
    agent.sprite.y += agent.direction.y * move;
  }
};

/* ------------------------------------------------------------------ */
/*  Level 5 hunter AI helpers                                          */
/* ------------------------------------------------------------------ */

/**
 * Determines whether a hunter should use BFS to chase the player.
 * On Level 5 only Mahi (D) always chases. Max (M) chases only while
 * sprinting. All other hunters wander randomly.
 * On every other level every hunter chases.
 */
GameScene.prototype.shouldChasePlayer = function shouldChasePlayer(hunter) {
  if (this.level !== 5) return true;

  // Mahi always chases
  if (hunter.type === "D") return true;

  // Max chases only during sprint
  if (hunter.type === "M" && hunter.isSprinting) return true;

  return false;
};

/**
 * Pick a random wandering direction for a hunter.
 * - 70 % chance to keep going straight if the path is clear.
 * - Otherwise pick a random valid turn, avoiding 180° reversals
 *   unless that is the only option.
 */
GameScene.prototype.pickWanderDirection = function pickWanderDirection(hunter) {
  const dirs = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ].filter(d => this.canHunterMove(hunter, hunter.cellX + d.x, hunter.cellY + d.y));

  if (dirs.length === 0) {
    hunter.direction = { x: 0, y: 0 };
    return;
  }

  // Prefer continuing straight
  const sameDir = dirs.find(
    d => d.x === hunter.direction.x && d.y === hunter.direction.y
  );
  if (sameDir && Math.random() < 0.7) {
    return; // keep current direction
  }

  // Avoid 180° reversal unless it's the only choice
  const nonReverse = dirs.filter(
    d => !(d.x === -hunter.direction.x && d.y === -hunter.direction.y)
  );
  const choices = nonReverse.length > 0 ? nonReverse : dirs;

  hunter.direction = Phaser.Utils.Array.GetRandom(choices);
};
