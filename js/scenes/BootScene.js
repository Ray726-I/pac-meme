class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    this.load.image("player_idle", "assets/player_idle_64.png");
    this.load.spritesheet("player_run", "assets/player_run_spritesheet.png", {
      frameWidth: 64,
      frameHeight: 64,
    });
    this.load.audio("player_audio", "assets/player.mp3");

    this.load.video("modi_video", "assets/wah_modiji_wah.mp4");

    this.load.image("chin_tapak", "assets/hunters/chin_tapak_dum_dum.png");
    this.load.audio("chin_audio", "assets/hunter-audio/chin_tapak_dum_dum.mp3");

    this.load.image("max_hunter", "assets/hunters/max.png");
    this.load.audio("max_audio", "assets/hunter-audio/max.mp3");
    this.load.image("amitabh_aag", "assets/hunters/amitabh-aag.png");
    this.load.audio("aag_audio", "assets/hunter-audio/aag.mp3");
    this.load.image("mahi_hunter", "assets/hunters/mahi.png");
    this.load.image("cricket_ball", "assets/cricket-ball.png");
    this.load.audio("mahi_throw_audio", "assets/hunter-audio/mahi-maar-raha-hai.mp3");
    this.load.audio("mahi_phase_audio", "assets/hunter-audio/bole-jo-koyal.mp3");
    this.load.audio("minecraft_damage", "assets/minecraft-damage.mp3");
    this.load.audio("eat_audio", "assets/eat.mp3");
    this.load.image("parleg", "assets/parleg.png");
    this.load.spritesheet("fire_projectile", "assets/fire_sheet.png", {
      frameWidth: 72,
      frameHeight: 96,
    });
  }

  create() {
    this.createGeneratedTextures();
    this.createPlayerAnimations();
    this.createHunterAnimations();
    this.scene.start("TitleScene");
  }

  createPlayerAnimations() {
    if (!this.anims.exists("player-run")) {
      this.anims.create({
        key: "player-run",
        frames: this.anims.generateFrameNumbers("player_run", {
          start: 24,
          end: 69,
        }),
        frameRate: 24,
        repeat: -1,
      });
    }
  }

  createHunterAnimations() {
    if (!this.anims.exists("fire-burn")) {
      this.anims.create({
        key: "fire-burn",
        frames: this.anims.generateFrameNumbers("fire_projectile", {
          start: 0,
          end: 5,
        }),
        frameRate: 14,
        repeat: -1,
      });
    }
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

    // Peach/pinkish square pellets from reference image
    gfx.fillStyle(0xffb8ae, 1);
    gfx.fillRect(3, 3, 4, 4);
    gfx.generateTexture("pellet", 10, 10);
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
