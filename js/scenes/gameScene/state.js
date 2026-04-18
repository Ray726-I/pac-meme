GameScene.prototype.initGameState = function initGameState(data) {
  const state = data || {};
  this.level = state.level || 1;
  this.score = state.score || 0;
  this.highScore = state.highScore || this.readHighScore();
  this.lives = state.lives || 3;

  this.invulnerable = false;
  this.gameOver = false;
  this.transitioning = false;
  this.fireProjectiles = [];
  this.cricketBalls = [];
  this.nextDirection = { x: 0, y: 0 };
  this.playerSoundEnabled = true;
  this.playerAudioPlayCount = 0;
  this.playerAudioReplayTimer = null;
  this.lastAnySpecialAt = -5000;
  this.minSpecialGapMs = 5000;
  if (this.level === 3 || this.level === 5) this.minSpecialGapMs = 4000;
  this.minAagTriggerDistanceTiles = 3.5;
  this._sixtySevenVideos = [];
};

GameScene.prototype.initPlayerAudio = function initPlayerAudio() {
  this.playerAudio = this.sound.add("player_audio", {
    volume: 0.25,
  });

  this.events.once("shutdown", this.teardownPlayerAudio, this);
  this.events.once("destroy", this.teardownPlayerAudio, this);
};

GameScene.prototype.teardownPlayerAudio = function teardownPlayerAudio() {
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
};

GameScene.prototype.collectPelletAt = function collectPelletAt(cx, cy) {
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
};

GameScene.prototype.handlePlayerCaught = function handlePlayerCaught() {
  if (this.invulnerable || this.transitioning || this.gameOver) return;

  this.clearFireProjectiles();
  this.clearCricketBalls();
  this.lives -= 1;
  this.sound.play("minecraft_damage");
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
};

GameScene.prototype.resetPlayerToSpawn = function resetPlayerToSpawn() {
  const a = this.playerAgent;
  a.cellX = this.playerSpawnCell.x;
  a.cellY = this.playerSpawnCell.y;
  a.direction = { x: 0, y: 0 };
  a.moving = false;
  a.sprite.setPosition(this.gridToWorld(a.cellX), this.gridToWorldY(a.cellY));
  this.updatePlayerVisualState();
};

GameScene.prototype.resetHuntersToSpawn = function resetHuntersToSpawn() {
  for (const h of this.hunters) {
    h.cellX = h.spawnCellX;
    h.cellY = h.spawnCellY;
    h.direction = { x: 0, y: 0 };
    h.moving = false;
    h.isSprinting = false;
    h.isTeleporting = false;
    h.isPhasing = false;
    h.decisionAt = this.time.now + 300;
    this.stopHunterPhaseAudio(h);
    this.tweens.killTweensOf(h.sprite);
    h.sprite
      .setPosition(this.gridToWorld(h.cellX), this.gridToWorldY(h.cellY))
      .setScale(h.baseScaleX, h.baseScaleY)
      .setAngle(0)
      .setVisible(true);
  }
};

GameScene.prototype.levelComplete = function levelComplete() {
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
};

GameScene.prototype.triggerGameOver = function triggerGameOver() {
  this.gameOver = true;
  this.stopAllAgents();
  this.updateHighScore(this.score);
  this.sound.stopAll();

  this.time.delayedCall(800, () => {
    this.scene.start("GameOverScene", {
      score: this.score,
      level: this.level,
      highScore: this.highScore,
    });
  });
};

GameScene.prototype.stopAllAgents = function stopAllAgents() {
  const a = this.playerAgent;
  a.direction = { x: 0, y: 0 };
  a.moving = false;
  a.sprite.setPosition(this.gridToWorld(a.cellX), this.gridToWorldY(a.cellY));
  this.updatePlayerVisualState();
  this.clearFireProjectiles();
  this.clearCricketBalls();
  this.removeSixtySevenMeme();

  for (const h of this.hunters) {
    h.direction = { x: 0, y: 0 };
    h.moving = false;
    h.isSprinting = false;
    h.isTeleporting = false;
    h.isPhasing = false;
    this.stopHunterPhaseAudio(h);
    this.tweens.killTweensOf(h.sprite);
    h.sprite.setPosition(this.gridToWorld(h.cellX), this.gridToWorldY(h.cellY));
    h.sprite.setScale(h.baseScaleX, h.baseScaleY).setAngle(0).setVisible(true);
  }
};

GameScene.prototype.readHighScore = function readHighScore() {
  try {
    return Number(window.localStorage.getItem("pacMemeHighScore") || 0);
  } catch (error) {
    return 0;
  }
};

GameScene.prototype.updateHighScore = function updateHighScore(nextScore) {
  if (nextScore <= this.highScore) return;

  this.highScore = nextScore;
  try {
    window.localStorage.setItem("pacMemeHighScore", String(this.highScore));
  } catch (error) {
    // Ignore storage failures.
  }
};

GameScene.prototype.shutdownGameScene = function shutdownGameScene() {
  this.clearFireProjectiles();
  this.clearCricketBalls();
  for (const hunter of this.hunters || []) {
    this.stopHunterPhaseAudio(hunter);
  }
  this.removeSixtySevenMeme();
};
