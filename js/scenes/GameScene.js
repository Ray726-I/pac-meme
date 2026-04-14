class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
    this.tileSize = 40;
    this.gridWidth = 16;
    this.gridHeight = 16;
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
    this.hunterDirection = { x: 0, y: 0 };
    this.hunterDecisionAt = 0;

    this.invulnerable = false;
    this.gameOver = false;
    this.transitioning = false;
  }

  create() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.restartKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.levelLayout = [
      "################",
      "#......##......#",
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
    this.hunterSpawn = { x: 0, y: 0 };

    this.buildLevel();
    this.createActors();
    this.createHud();

    this.physics.add.collider(this.player, this.walls);
    this.physics.add.collider(this.hunter, this.walls);
    this.physics.add.collider(this.player, this.hunter, this.handlePlayerCaught, null, this);
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
    this.updateHunterMovement(time);
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
        } else if (cell === "H") {
          this.hunterSpawn = { x: worldX, y: worldY };
        }
      }
    }
  }

  createActors() {
    this.player = this.physics.add.sprite(this.playerSpawn.x, this.playerSpawn.y, "player");
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(2);
    this.player.body.setSize(22, 22);

    this.hunter = this.physics.add.sprite(this.hunterSpawn.x, this.hunterSpawn.y, "hunter");
    this.hunter.setCollideWorldBounds(true);
    this.hunter.setDepth(2);
    this.hunter.body.setSize(22, 22);
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

  updateHunterMovement(time) {
    const hunterCell = this.worldToGrid(this.hunter.x, this.hunter.y);
    const atCenter = this.isAtCellCenter(this.hunter, hunterCell);

    if (atCenter) {
      this.snapToCellCenter(this.hunter, hunterCell);

      if (time >= this.hunterDecisionAt) {
        const playerCell = this.worldToGrid(this.player.x, this.player.y);
        const nextStep = this.findPathStep(hunterCell, playerCell);

        if (nextStep) {
          this.hunterDirection = {
            x: nextStep.x - hunterCell.x,
            y: nextStep.y - hunterCell.y,
          };
        }

        this.hunterDecisionAt = time + 180;
      }

      if (!this.canMove(hunterCell.x + this.hunterDirection.x, hunterCell.y + this.hunterDirection.y)) {
        this.hunterDirection = { x: 0, y: 0 };
      }
    }

    const levelBoost = (this.level - 1) * 9;
    const hunterSpeed = Phaser.Math.Clamp(this.baseHunterSpeed + levelBoost, 95, 220);
    this.hunter.body.setVelocity(this.hunterDirection.x * hunterSpeed, this.hunterDirection.y * hunterSpeed);
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
    this.hunter.body.setVelocity(0, 0);
    this.currentDirection = { x: 0, y: 0 };
    this.nextDirection = { x: 0, y: 0 };
    this.hunterDirection = { x: 0, y: 0 };

    this.player.setPosition(this.playerSpawn.x, this.playerSpawn.y);
    this.hunter.setPosition(this.hunterSpawn.x, this.hunterSpawn.y);

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

  levelComplete() {
    if (this.transitioning || this.gameOver) {
      return;
    }

    this.transitioning = true;
    this.player.body.setVelocity(0, 0);
    this.hunter.body.setVelocity(0, 0);
    this.currentDirection = { x: 0, y: 0 };
    this.hunterDirection = { x: 0, y: 0 };

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
    this.hunter.body.setVelocity(0, 0);

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
    return Math.abs(sprite.x - centerX) < 2 && Math.abs(sprite.y - centerY) < 2;
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
