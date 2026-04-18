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
    this.initGameState(data);
  }

  create() {
    this.cursors = this.input.keyboard.createCursorKeys();

    this.levelLayout = window.GameLevels[this.level] || window.GameLevels[1];
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

    this.collectPelletAt(this.playerAgent.cellX, this.playerAgent.cellY);
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
    this.updateCricketBalls(delta);
    this.checkHunterContact();
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

  canHunterMove(hunter, cellX, cellY) {
    if (cellX < 0 || cellY < 0 || cellX >= this.gridWidth || cellY >= this.gridHeight) {
      return false;
    }

    const isWall = this.levelLayout[cellY][cellX] === "#";

    if (hunter.isPhasing && isWall) {
      // Never phase through border walls (outermost ring of the map)
      if (cellX <= 0 || cellX >= this.gridWidth - 1 ||
          cellY <= 0 || cellY >= this.gridHeight - 1) {
        return false;
      }
      // Any interior wall is fair game — the safety teleport in
      // triggerMahiPhasingSequence handles landing inside a wall.
      return true;
    }

    return !isWall;
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
}
