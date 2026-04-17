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

    this.add.rectangle(cx, cy, W, H, 0x0f172a).setDepth(0);

    this.add.text(cx, 80, `LEVEL ${this.level} CLEARED!`, {
      fontFamily: 'PacFont',
      fontSize: "42px",
      color: "#4ade80",
      align: "center",
      shadow: { blur: 14, color: "#4ade80", fill: true },
    }).setOrigin(0.5).setDepth(1);

    this._spawnVideoSequence(W, H);
  }

  _spawnVideoSequence(W, H) {
    const canvas = this.sys.game.canvas;
    const rect = canvas.getBoundingClientRect();

    const vidW = Math.round(rect.width * 0.8);
    const vidH = Math.round(vidW * (9 / 16));
    const vidX = Math.round(rect.left + (rect.width - vidW) / 2);
    const vidY = Math.round(rect.top + (rect.height - vidH) / 2) + 30; // Shift down slightly 

    const vid = document.createElement("video");
    vid.src = "assets/bahut-hi-sundar-tarike-se-apne-khela-video-meme-download.mp4";
    vid.autoplay = true;
    vid.loop = false;
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

    let phase = 1;

    vid.onended = () => {
      if (phase === 1) {
        phase = 2;
        vid.src = "assets/wah_modiji_wah.mp4";
        vid.play();
      } else {
        this._removeVideo();
        this._showUIItems(W, H);
      }
    };

    document.body.appendChild(vid);
    this._videoEl = vid;
  }

  _showUIItems(W, H) {
    const cx = W / 2;
    const cy = H / 2;

    const textStyle = {
      fontFamily: 'PacFont',
      fontSize: "24px",
      color: "#cbd5e1",
      padding: { x: 14, y: 14 },
      backgroundColor: "#1e293b",
    };

    const replayBtn = this.add.text(cx, cy - 80, `❯ Play Again`, textStyle)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setDepth(1);

    replayBtn.on("pointerover", () => replayBtn.setBackgroundColor("#334155").setColor("#38bdf8"));
    replayBtn.on("pointerout", () => replayBtn.setBackgroundColor("#1e293b").setColor("#cbd5e1"));
    replayBtn.on("pointerdown", () => {
      this.scene.start("GameScene", {
        score: this.score,
        highScore: this.highScore,
        level: this.level,
        lives: this.lives,
      });
    });

    // Render level specific "Another Level" selections
    const levelKeys = Object.keys(window.GameLevels || { 1: true });
    
    levelKeys.forEach((lvlStr, index) => {
      const lvl = parseInt(lvlStr, 10);
      if (lvl === this.level) return; // Skip current level, that's already "Play Again"

      const yOffset = -10 + (index * 70); 

      const otherLvlBtn = this.add.text(cx, cy + yOffset, `Another Level (${lvl})`, textStyle)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .setDepth(1);

      otherLvlBtn.on("pointerover", () => otherLvlBtn.setBackgroundColor("#334155").setColor("#fb923c"));
      otherLvlBtn.on("pointerout", () => otherLvlBtn.setBackgroundColor("#1e293b").setColor("#cbd5e1"));
      otherLvlBtn.on("pointerdown", () => {
        this.scene.start("GameScene", {
          score: this.score,
          highScore: this.highScore,
          level: lvl,
          lives: this.lives,
        });
      });
    });
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
