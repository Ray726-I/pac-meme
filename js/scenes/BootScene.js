class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    // Intentionally left minimal for starter setup.
  }

  create() {
    this.createGeneratedTextures();
    this.scene.start("StartScene");
  }

  createGeneratedTextures() {
    const tileSize = 40;
    const gfx = this.make.graphics({ x: 0, y: 0, add: false });

    // Heart texture for lives
    gfx.fillStyle(0xef4444, 1);
    gfx.beginPath();
    gfx.arc(8, 8, 6, Math.PI, 0, false);
    gfx.arc(20, 8, 6, Math.PI, 0, false);
    gfx.lineTo(14, 24);
    gfx.closePath();
    gfx.fillPath();
    gfx.generateTexture("heart", 28, 28);
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
