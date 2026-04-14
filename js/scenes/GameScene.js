class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
    this.tileSize = 40;
    this.gridWidth = 32;
    this.gridHeight = 16;
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
    this.nextDirection = { x: 0, y: 0 };
  }

  create() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.restartKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.levelLayout = [
      "################################",
      "#..K..............##.......K..#",
      "#.####.####.####.##.####.####.#",
      "#.#....#...#.#...#.#...#.#...#.#",
      "#.#.##.#.#.#.#.#.#.#.#.#.#.#.#.#",
      "#....#...#....#.......#....#...#",
      "####.###.#######.###.###.###.##",
      "#......P.......##......P.......#",
      "#.####.##.####.##.####.##.####.#",
      "#.#....##....#.##.#....##....#.#",
      "#.#.##.##.##.#.##.#.##.##.##.#.#",
      "#....#....#....##....#....#....#",
      "####.#.##.#.########.#.##.#.####",
      "#......##......##......##......#",
      "#.####..H.####.##.####..H.####.#",
      "################################",
    ];

    this.pelletByCell = new Map();
    this.playerSpawnCell = { x: 7, y: 7 };
    this.hunterSpawnCells = [];

    this.buildLevel();
    this.createActors();
    this.createHud();

    // Remove pellet under the player at start
    this.collectPelletAt(this.playerAgent.cellX, this.playerAgent.cellY);
  }

  update(time, delta) {
    if (this.gameOver) {
      if (Phaser.Input.Keyboard.JustDown(this.restartKey)) {
        this.scene.restart({ level: 1, score: 0, highScore: this.highScore, lives: 3 });
      }
      return;
    }

    if (this.transitioning) return;

    this.readPlayerInput();
    this.movePlayer(delta);
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
          this.add.image(wx, wy, "wall").setDepth(1);
        } else if (cell === ".") {
          const pellet = this.add.image(wx, wy, "pellet").setDepth(2);
          this.pelletByCell.set(`${col},${row}`, pellet);
        } else if (cell === "P") {
          this.playerSpawnCell = { x: col, y: row };
        } else if (cell === "H" || cell === "K") {
          this.hunterSpawnCells.push({ x: col, y: row });
        }
      }
    }

    if (this.hunterSpawnCells.length === 0) {
      this.hunterSpawnCells.push({ x: 8, y: 14 });
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Actor creation                                                     */
  /* ------------------------------------------------------------------ */

  createActors() {
    const px = this.gridToWorld(this.playerSpawnCell.x);
    const py = this.gridToWorld(this.playerSpawnCell.y);

    this.playerAgent = {
      sprite: this.add.sprite(px, py, "player").setDepth(4),
      cellX: this.playerSpawnCell.x,
      cellY: this.playerSpawnCell.y,
      direction: { x: 0, y: 0 },
      moving: false,
      speed: this.basePlayerSpeed,
    };

    this.hunters = this.hunterSpawnCells.map((spawn, i) => {
      const sx = this.gridToWorld(spawn.x);
      const sy = this.gridToWorld(spawn.y);
      const sprite = this.add.sprite(sx, sy, "hunter").setDepth(4);
      sprite.setScale(0.08);

      return {
        sprite,
        cellX: spawn.x,
        cellY: spawn.y,
        spawnCellX: spawn.x,
        spawnCellY: spawn.y,
        direction: { x: 0, y: 0 },
        moving: false,
        speed: this.baseHunterSpeed + i * 8,
        decisionAt: 0,
      };
    });
  }

  /* ------------------------------------------------------------------ */
  /*  HUD                                                                */
  /* ------------------------------------------------------------------ */

  createHud() {
    this.hudStyle = {
      fontFamily: "Trebuchet MS",
      fontSize: "18px",
      color: "#e2e8f0",
      stroke: "#020617",
      strokeThickness: 4,
    };

    this.scoreText = this.add.text(10, 8, "", this.hudStyle).setDepth(6);
    this.levelText = this.add.text(10, 32, "", this.hudStyle).setDepth(6);
    this.livesText = this.add.text(10, 56, "", this.hudStyle).setDepth(6);

    this.noticeText = this.add
      .text(this.scale.width / 2, this.scale.height / 2, "", {
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

    // Allow instant 180 reversal while moving
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
  }

  /* ------------------------------------------------------------------ */
  /*  Hunter movement                                                    */
  /* ------------------------------------------------------------------ */

  moveHunters(delta, time) {
    // Get all spawn cells to avoid targeting unreachable hunters
    const spawns = this.hunterSpawnCells;

    for (const hunter of this.hunters) {
      // Decide direction when at a cell center (not moving)
      if (!hunter.moving) {
        // Always try to get a direction if we don't have one
        if (hunter.direction.x === 0 && hunter.direction.y === 0) {
          this.chooseHunterDirection(hunter, time);
        }

        // Also periodically re-evaluate
        if (time >= hunter.decisionAt) {
          this.chooseHunterDirection(hunter, time);
        }

        // Validate / fallback if chosen direction is blocked
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
        const speed = Phaser.Math.Clamp(hunter.speed + levelBoost, 95, 250);
        this.advanceAgent(hunter, delta, speed);
      }
    }
  }

  chooseHunterDirection(hunter, time) {
    // Find path to player
    const start = { x: hunter.cellX, y: hunter.cellY };
    const goal = { x: this.playerAgent.cellX, y: this.playerAgent.cellY };
    const nextStep = this.findPathStep(start, goal);

    if (nextStep) {
      hunter.direction = {
        x: nextStep.x - start.x,
        y: nextStep.y - start.y,
      };
    }

    hunter.decisionAt = time + Phaser.Math.Between(200, 400);
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
    this.score += 10;
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
  /*  Level flow                                                         */
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
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    this.add
      .rectangle(centerX, centerY, 420, 220, 0x020617, 0.88)
      .setStrokeStyle(2, 0x38bdf8, 0.9)
      .setDepth(8);

    this.add
      .text(centerX, centerY - 70, "Game Over", {
        fontFamily: "Trebuchet MS",
        fontSize: "40px",
        color: "#f8fafc",
      })
      .setOrigin(0.5)
      .setDepth(9);

    this.add
      .text(centerX, centerY - 12, `Score: ${this.score}`, {
        fontFamily: "Trebuchet MS",
        fontSize: "24px",
        color: "#e2e8f0",
      })
      .setOrigin(0.5)
      .setDepth(9);

    this.add
      .text(centerX, centerY + 22, `High Score: ${this.highScore}`, {
        fontFamily: "Trebuchet MS",
        fontSize: "22px",
        color: "#bae6fd",
      })
      .setOrigin(0.5)
      .setDepth(9);

    this.add
      .text(centerX, centerY + 66, "Press SPACE to restart", {
        fontFamily: "Trebuchet MS",
        fontSize: "18px",
        color: "#f8fafc",
      })
      .setOrigin(0.5)
      .setDepth(9);
  }

  stopAllAgents() {
    this.playerAgent.direction = { x: 0, y: 0 };
    this.playerAgent.moving = false;

    for (const hunter of this.hunters) {
      hunter.direction = { x: 0, y: 0 };
      hunter.moving = false;
    }
  }

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
    this.livesText.setText(`Lives: ${this.lives}`);
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
