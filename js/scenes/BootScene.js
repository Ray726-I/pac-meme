class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    // Intentionally left minimal for starter setup.
  }

  create() {
    this.createGeneratedTextures();
    this.scene.start("GameScene", {
      level: 1,
      score: 0,
      highScore: Number(window.localStorage.getItem("pacMemeHighScore") || 0),
    });
  }

  createGeneratedTextures() {
    const tileSize = 40;
    const gfx = this.make.graphics({ x: 0, y: 0, add: false });

    gfx.fillStyle(0x1d4ed8, 1);
    gfx.fillRect(0, 0, tileSize, tileSize);
    gfx.lineStyle(2, 0x93c5fd, 0.9);
    gfx.strokeRect(1, 1, tileSize - 2, tileSize - 2);
    gfx.generateTexture("wall", tileSize, tileSize);
    gfx.clear();

    gfx.fillStyle(0xf8fafc, 1);
    gfx.fillCircle(5, 5, 4);
    gfx.generateTexture("pellet", 10, 10);
    gfx.clear();

    gfx.fillStyle(0xfacc15, 1);
    gfx.fillCircle(14, 14, 13);
    gfx.fillStyle(0x111827, 1);
    gfx.fillCircle(18, 10, 2);
    gfx.generateTexture("player", 28, 28);
    gfx.clear();

    gfx.fillStyle(0xef4444, 1);
    gfx.fillCircle(14, 11, 10);
    gfx.fillRect(4, 11, 20, 12);
    gfx.fillStyle(0xffffff, 1);
    gfx.fillCircle(10, 12, 3);
    gfx.fillCircle(18, 12, 3);
    gfx.fillStyle(0x111827, 1);
    gfx.fillCircle(10, 12, 1);
    gfx.fillCircle(18, 12, 1);
    gfx.generateTexture("hunter", 28, 28);
    gfx.destroy();
  }
}
