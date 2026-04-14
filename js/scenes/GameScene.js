class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
    this.tileSize = 40;
    this.gridWidth = 16;
    this.gridHeight = 16;
    this.centerSnapThreshold = 1.1;
    this.basePlayerSpeed = 160;
    this.baseHunterSpeed = 95;
  }

  init(data) {
    this.level = data.level || 1;
    this.score = data.score || 0;
    this.highScore = data.highScore || this.readHighScore();
    this.lives = data.lives || 3;

    this.currentDirection = { x: 0, y: 0 };
    this.nextDirection = { x: 0, y: 0 };

    this.invulnerable = false;
    this.gameOver = false;
    this.transitioning = false;
  }

  create() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.restartKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.levelLayout = [
      "################",
      "#..K...##......#",
      "#.####.##.####.#",
      "#.#....##....#.#",
      "#.#.##.##.##.#.#",
      "#....#....#....#",
      "####.#.##.#.####",
      "#......P.......#",
      "#.####.##.####.#",
      "#.#....##....#.#",
      "#.#.##.##.##.#.#",
      "#....#....#....#",
      "####.#.##.#.####",
      "#......##......#",
      "#.####..H.####.#",
      "################",
    ];

    this.walls = this.physics.add.staticGroup();
    this.pellets = this.physics.add.staticGroup();
    this.playerSpawn = { x: 0, y: 0 };
    this.hunterSpawns = [];

    this.buildLevel();
    this.createActors();
    this.createHud();

    this.physics.add.collider(this.player, this.walls);

    for (const hunter of this.hunters) {
      this.physics.add.collider(hunter.sprite, this.walls);
      this.physics.add.overlap(this.player, hunter.sprite, this.handlePlayerCaught, null, this);
    }

    this.physics.add.overlap(this.player, this.pellets, this.handlePellet, null, this);
  }

  update(time) {
    if (this.gameOver) {
      if (Phaser.Input.Keyboard.JustDown(this.restartKey)) {
        this.scene.restart({ level: 1, score: 0, highScore: this.highScore, lives: 3 });
      }
      return;
    }

    if (this.transitioning) {
      return;
    }

    this.updatePlayerDirection();
    this.updatePlayerMovement();
    this.updateHuntersMovement(time);
  }

  buildLevel() {
    for (let row = 0; row < this.gridHeight; row += 1) {
      for (let col = 0; col < this.gridWidth; col += 1) {
        const cell = this.levelLayout[row][col];
        const worldX = this.gridToWorld(col);
        const worldY = this.gridToWorld(row);

        if (cell === "#") {
          this.walls.create(worldX, worldY, "wall");
        } else if (cell === ".") {
          this.pellets.create(worldX, worldY, "pellet");
        } else if (cell === "P") {
          this.playerSpawn = { x: worldX, y: worldY };
        } else if (cell === "H" || cell === "K") {
          this.hunterSpawns.push({ x: worldX, y: worldY });
        }
      }
    }

    if (this.hunterSpawns.length === 0) {
      this.hunterSpawns.push({ x: this.gridToWorld(8), y: this.gridToWorld(14) });
    }
  }

  createActors() {
    this.player = this.physics.add.sprite(this.playerSpawn.x, this.playerSpawn.y, "player");
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(2);
    this.player.body.setSize(22, 22);

    this.hunters = this.hunterSpawns.map((spawn, index) => {
      const sprite = this.physics.add.sprite(spawn.x, spawn.y, "hunter");
      sprite.setCollideWorldBounds(true);
      sprite.setDepth(2);
      sprite.body.setSize(22, 22);

      if (index === 1) {
        sprite.setTint(0xfb923c);
      }

      return {
        sprite,
        spawn: { ...spawn },
        direction: { x: 0, y: 0 },
        nextThinkAt: 0,
        baseSpeed: this.baseHunterSpeed + index * 8,
      };
    });
  }

  createHud() {
    this.hudStyle = {
      fontFamily: "Trebuchet MS",
      fontSize: "18px",
      color: "#e2e8f0",
      stroke: "#020617",
      strokeThickness: 4,
    };

    this.scoreText = this.add.text(10, 8, "", this.hudStyle).setDepth(5);
    this.levelText = this.add.text(10, 32, "", this.hudStyle).setDepth(5);
    this.livesText = this.add.text(10, 56, "", this.hudStyle).setDepth(5);

    this.noticeText = this.add
      .text(this.scale.width / 2, this.scale.height / 2, "", {
        fontFamily: "Trebuchet MS",
        fontSize: "34px",
        color: "#f8fafc",
        stroke: "#020617",
        strokeThickness: 6,
      })
      .setDepth(6)
      .setOrigin(0.5)
      .setVisible(false);

    this.refreshHud();
  }

  updatePlayerDirection() {
    if (this.cursors.left.isDown) {
      this.nextDirection = { x: -1, y: 0 };
    } else if (this.cursors.right.isDown) {
      this.nextDirection = { x: 1, y: 0 };
    } else if (this.cursors.up.isDown) {
      this.nextDirection = { x: 0, y: -1 };
    } else if (this.cursors.down.isDown) {
      this.nextDirection = { x: 0, y: 1 };
    }
  }

  updatePlayerMovement() {
    const playerCell = this.worldToGrid(this.player.x, this.player.y);
    const atCenter = this.isAtCellCenter(this.player, playerCell);

    if (atCenter) {
      this.snapToCellCenter(this.player, playerCell);

      if (this.canMove(playerCell.x + this.nextDirection.x, playerCell.y + this.nextDirection.y)) {
        this.currentDirection = { ...this.nextDirection };
      }

      if (!this.canMove(playerCell.x + this.currentDirection.x, playerCell.y + this.currentDirection.y)) {
        this.currentDirection = { x: 0, y: 0 };
      }
    }

    this.player.body.setVelocity(
      this.currentDirection.x * this.basePlayerSpeed,
      this.currentDirection.y * this.basePlayerSpeed
    );
  }

  updateHuntersMovement(time) {
    const playerCell = this.worldToGrid(this.player.x, this.player.y);

    for (const hunter of this.hunters) {
      const hunterCell = this.worldToGrid(hunter.sprite.x, hunter.sprite.y);
      const atCenter = this.isAtCellCenter(hunter.sprite, hunterCell);
      const needsDirection = hunter.direction.x === 0 && hunter.direction.y === 0;

      if (atCenter || needsDirection) {
        this.snapToCellCenter(hunter.sprite, hunterCell);

        if (time >= hunter.nextThinkAt || needsDirection) {
          const nextStep = this.findPathStep(hunterCell, playerCell);

          if (nextStep) {
            hunter.direction = {
              x: nextStep.x - hunterCell.x,
              y: nextStep.y - hunterCell.y,
            };
          } else {
            hunter.direction = this.pickRandomDirection(hunterCell, hunter.direction);
          }

          hunter.nextThinkAt = time + Phaser.Math.Between(120, 210);
        }

        if (!this.canMove(hunterCell.x + hunter.direction.x, hunterCell.y + hunter.direction.y)) {
          hunter.direction = this.pickRandomDirection(hunterCell, { x: 0, y: 0 });
        }
      }

      const levelBoost = (this.level - 1) * 8;
      const hunterSpeed = Phaser.Math.Clamp(hunter.baseSpeed + levelBoost, 95, 250);
      hunter.sprite.body.setVelocity(hunter.direction.x * hunterSpeed, hunter.direction.y * hunterSpeed);
    }
  }

  pickRandomDirection(cell, preferredDirection) {
    const directions = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];

    const options = directions.filter((dir) => this.canMove(cell.x + dir.x, cell.y + dir.y));

    if (options.length === 0) {
      return { x: 0, y: 0 };
    }

    if (preferredDirection.x !== 0 || preferredDirection.y !== 0) {
      const keepCurrent = options.find(
        (dir) => dir.x === preferredDirection.x && dir.y === preferredDirection.y
      );

      if (keepCurrent && Math.random() < 0.6) {
        return keepCurrent;
      }
    }

    return Phaser.Utils.Array.GetRandom(options);
  }

  handlePellet(player, pellet) {
    if (!pellet.active || this.transitioning || this.gameOver) {
      return;
    }

    pellet.destroy();
    this.score += 10;
    this.refreshHud();

    if (this.pellets.countActive(true) === 0) {
      this.levelComplete();
    }
  }

  handlePlayerCaught() {
    if (this.invulnerable || this.transitioning || this.gameOver) {
      return;
    }

    this.lives -= 1;
    this.refreshHud();

    if (this.lives <= 0) {
      this.triggerGameOver();
      return;
    }

    this.invulnerable = true;
    this.player.body.setVelocity(0, 0);
    this.currentDirection = { x: 0, y: 0 };
    this.nextDirection = { x: 0, y: 0 };

    this.player.setPosition(this.playerSpawn.x, this.playerSpawn.y);
    this.resetHuntersToSpawn();

    this.tweens.add({
      targets: this.player,
      alpha: 0.2,
      duration: 100,
      yoyo: true,
      repeat: 7,
      onComplete: () => {
        this.player.setAlpha(1);
        this.invulnerable = false;
      },
    });
  }

  resetHuntersToSpawn() {
    for (const hunter of this.hunters) {
      hunter.sprite.body.setVelocity(0, 0);
      hunter.sprite.setPosition(hunter.spawn.x, hunter.spawn.y);
      hunter.direction = { x: 0, y: 0 };
      hunter.nextThinkAt = this.time.now + 150;
    }
  }

  levelComplete() {
    if (this.transitioning || this.gameOver) {
      return;
    }

    this.transitioning = true;
    this.player.body.setVelocity(0, 0);
    this.stopHunters();
    this.currentDirection = { x: 0, y: 0 };

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
    this.player.body.setVelocity(0, 0);
    this.stopHunters();

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

  stopHunters() {
    for (const hunter of this.hunters) {
      hunter.sprite.body.setVelocity(0, 0);
      hunter.direction = { x: 0, y: 0 };
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
      onComplete: () => {
        this.noticeText.setVisible(false);
      },
    });
  }

  gridToWorld(cell) {
    return cell * this.tileSize + this.tileSize / 2;
  }

  worldToGrid(worldX, worldY) {
    return {
      x: Phaser.Math.Clamp(Math.floor(worldX / this.tileSize), 0, this.gridWidth - 1),
      y: Phaser.Math.Clamp(Math.floor(worldY / this.tileSize), 0, this.gridHeight - 1),
    };
  }

  isAtCellCenter(sprite, cell) {
    const centerX = this.gridToWorld(cell.x);
    const centerY = this.gridToWorld(cell.y);
    return (
      Math.abs(sprite.x - centerX) <= this.centerSnapThreshold &&
      Math.abs(sprite.y - centerY) <= this.centerSnapThreshold
    );
  }

  snapToCellCenter(sprite, cell) {
    sprite.setPosition(this.gridToWorld(cell.x), this.gridToWorld(cell.y));
  }

  canMove(cellX, cellY) {
    if (cellX < 0 || cellY < 0 || cellX >= this.gridWidth || cellY >= this.gridHeight) {
      return false;
    }

    return this.levelLayout[cellY][cellX] !== "#";
  }

  findPathStep(start, goal) {
    if (start.x === goal.x && start.y === goal.y) {
      return null;
    }

    const queue = [start];
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

      if (!current) {
        break;
      }

      if (current.x === goal.x && current.y === goal.y) {
        break;
      }

      for (const dir of directions) {
        const nextX = current.x + dir.x;
        const nextY = current.y + dir.y;
        const nextKey = `${nextX},${nextY}`;

        if (visited.has(nextKey) || !this.canMove(nextX, nextY)) {
          continue;
        }

        visited.add(nextKey);
        cameFrom.set(nextKey, current);
        queue.push({ x: nextX, y: nextY });
      }
    }

    const goalKey = `${goal.x},${goal.y}`;
    if (!cameFrom.has(goalKey)) {
      return null;
    }

    let step = { ...goal };
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
    if (nextScore <= this.highScore) {
      return;
    }

    this.highScore = nextScore;

    try {
      window.localStorage.setItem("pacMemeHighScore", String(this.highScore));
    } catch (error) {
      // Ignore storage failures.
    }
  }
}
