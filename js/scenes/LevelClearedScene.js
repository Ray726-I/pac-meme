class LevelClearedScene extends Phaser.Scene {
  constructor() {
    super("LevelClearedScene");
    this._videoEl = null;
  }

  init(data) {
    this.score = data.score || 0;
    this.highScore = data.highScore || 0;
    this.level = data.level || 1;
    this.lives = data.lives || 3;
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    const cx = W / 2;
    const cy = H / 2;

    // Dark overlay background
    this.add.rectangle(cx, cy, W, H, 0x0f172a).setDepth(0);

    // Header
    this.add.text(cx, 80, `LEVEL ${this.level} CLEARED!`, {
      fontFamily: '"Press Start 2P"',
      fontSize: "22px",
      color: "#4ade80",
      align: "center",
      shadow: { blur: 14, color: "#4ade80", fill: true },
    }).setOrigin(0.5).setDepth(1);

    // Left Side: UI Buttons
    const textStyle = {
      fontFamily: '"Press Start 2P"',
      fontSize: "13px",
      color: "#cbd5e1",
      padding: { x: 14, y: 14 },
      backgroundColor: "#1e293b",
    };

    const nextLevelBtn = this.add.text(W * 0.22, cy - 20, "▶  Next Level", textStyle)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setDepth(1);

    nextLevelBtn.on("pointerover", () => nextLevelBtn.setBackgroundColor("#334155").setColor("#fb923c"));
    nextLevelBtn.on("pointerout", () => nextLevelBtn.setBackgroundColor("#1e293b").setColor("#cbd5e1"));
    nextLevelBtn.on("pointerdown", () => {
      this._removeVideo();
      this.scene.start("GameScene", {
        score: this.score,
        highScore: this.highScore,
        level: this.level + 1,
        lives: this.lives,
      });
    });

    const replayBtn = this.add.text(W * 0.22, cy + 60, `↺  Replay Level ${this.level}`, textStyle)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setDepth(1);

    replayBtn.on("pointerover", () => replayBtn.setBackgroundColor("#334155").setColor("#38bdf8"));
    replayBtn.on("pointerout", () => replayBtn.setBackgroundColor("#1e293b").setColor("#cbd5e1"));
    replayBtn.on("pointerdown", () => {
      this._removeVideo();
      this.scene.start("GameScene", {
        score: this.score,
        highScore: this.highScore,
        level: this.level,
        lives: this.lives,
      });
    });

    // Right side: Native HTML video overlay
    this._spawnVideo(W, H);
  }

  _spawnVideo(W, H) {
    // Find the game canvas to position relative to it
    const canvas = this.sys.game.canvas;
    const rect = canvas.getBoundingClientRect();

    // Video occupies the right half of the canvas
    const vidW = Math.round(rect.width * 0.5);
    const vidH = Math.round(vidW * (9 / 16));
    const vidX = Math.round(rect.left + rect.width * 0.5);
    const vidY = Math.round(rect.top + (rect.height - vidH) / 2);

    const vid = document.createElement("video");
    vid.src = "assets/wah_modiji_wah.mp4";
    vid.autoplay = true;
    vid.loop = true;
    vid.muted = false;
    vid.playsInline = true;
    vid.style.position = "fixed";
    vid.style.left = vidX + "px";
    vid.style.top = vidY + "px";
    vid.style.width = vidW + "px";
    vid.style.height = vidH + "px";
    vid.style.zIndex = "9999";
    vid.style.borderRadius = "12px";
    vid.style.boxShadow = "0 0 30px rgba(74,222,128,0.4)";
    vid.style.objectFit = "cover";

    document.body.appendChild(vid);
    this._videoEl = vid;
  }

  _removeVideo() {
    if (this._videoEl) {
      this._videoEl.pause();
      this._videoEl.remove();
      this._videoEl = null;
    }
  }

  shutdown() {
    this._removeVideo();
  }
}
