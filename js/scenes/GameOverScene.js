class GameOverScene extends Phaser.Scene {
  constructor() {
    super("GameOverScene");
    this._videoEl = null;
    this.menuLayer = null;
    this.levelSelectLayer = null;
  }

  init(data) {
    this.score = data.score || 0;
    this.level = data.level || 1;
    this.highScore = data.highScore || Number(window.localStorage.getItem("pacMemeHighScore") || 0);
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    const cx = W / 2;
    const cy = H / 2;

    // Background for labels
    this.add.rectangle(cx, cy, W, H, 0x0f172a).setDepth(0);

    // Create the layers but hide them initially
    this.menuLayer = this.add.container(0, 0).setVisible(false).setDepth(10);
    this.levelSelectLayer = this.add.container(0, 0).setVisible(false).setDepth(10);

    this._createMenuUI(cx, cy);
    this._createLevelSelectUI(cx, cy);

    // Initial phase: Play the losing video
    this._playLosingVideo(W, H);
  }

  _playLosingVideo(W, H) {
    const canvas = this.sys.game.canvas;
    const rect = canvas.getBoundingClientRect();

    const vidW = Math.round(rect.width * 0.9);
    const vidH = Math.round(vidW * (9 / 16));
    const vidX = Math.round(rect.left + (rect.width - vidW) / 2);
    const vidY = Math.round(rect.top + (rect.height - vidH) / 2);

    const vid = document.createElement("video");
    vid.src = "assets/losing.mp4";
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
    vid.style.boxShadow = "0 0 40px rgba(239, 68, 68, 0.5)";
    vid.style.objectFit = "cover";

    // Volume Boost using Web Audio API
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaElementSource(vid);
      const gainNode = audioCtx.createGain();
      
      gainNode.gain.value = 5.0; // Boost to 500%
      
      source.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      // Ensure context is running (it might be suspended by browser)
      vid.onplay = () => {
        if (audioCtx.state === 'suspended') {
          audioCtx.resume();
        }
      };
      
      this._audioCtx = audioCtx; // Store for cleanup
    } catch (e) {
      console.warn("Web Audio volume boost failed, falling back to default volume.", e);
    }

    document.body.appendChild(vid);
    this._videoEl = vid;

    vid.onended = () => {
      this._removeVideo();
      this.menuLayer.setVisible(true);
    };

    vid.onerror = () => {
      console.error("Losing video failed to load, skipping to menu.");
      this._removeVideo();
      this.menuLayer.setVisible(true);
    };
  }

  _createMenuUI(cx, cy) {
    this.menuLayer.add(
      this.add.rectangle(cx, cy, 520, 300, 0x0f172a, 0.9)
        .setStrokeStyle(3, 0xef4444, 1)
    );

    const title = this.add.text(cx, cy - 80, "GAME OVER", {
      fontFamily: 'PacFont',
      fontSize: "48px",
      color: "#f87171",
      shadow: { blur: 15, color: "#ef4444", fill: true }
    }).setOrigin(0.5);

    const scoreText = this.add.text(cx, cy - 10, `Score: ${this.score}`, {
      fontFamily: 'PacFont',
      fontSize: "26px",
      color: "#e2e8f0"
    }).setOrigin(0.5);

    const btnStyle = {
      fontFamily: 'PacFont',
      fontSize: "22px",
      color: "#cbd5e1",
      padding: { x: 20, y: 14 },
      backgroundColor: "#1e293b",
    };

    const tryAgainBtn = this.add.text(cx - 120, cy + 70, "Try Again", btnStyle)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const newGameBtn = this.add.text(cx + 120, cy + 70, "New Game", btnStyle)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    tryAgainBtn.on("pointerover", () => tryAgainBtn.setBackgroundColor("#334155").setColor("#38bdf8"));
    tryAgainBtn.on("pointerout", () => tryAgainBtn.setBackgroundColor("#1e293b").setColor("#cbd5e1"));
    tryAgainBtn.on("pointerdown", () => {
      this.scene.start("GameScene", {
        level: this.level,
        score: 0,
        highScore: this.highScore,
        lives: 3
      });
    });

    newGameBtn.on("pointerover", () => newGameBtn.setBackgroundColor("#334155").setColor("#facc15"));
    newGameBtn.on("pointerout", () => newGameBtn.setBackgroundColor("#1e293b").setColor("#cbd5e1"));
    newGameBtn.on("pointerdown", () => {
      this.menuLayer.setVisible(false);
      this.levelSelectLayer.setVisible(true);
    });

    this.menuLayer.add([title, scoreText, tryAgainBtn, newGameBtn]);
  }

  _createLevelSelectUI(cx, cy) {
    this.levelSelectLayer.add(
      this.add.rectangle(cx, cy, 600, 480, 0x0f172a, 0.95)
        .setStrokeStyle(3, 0xfacc15, 1)
    );

    const selectTitle = this.add.text(cx, cy - 180, "Select Level", {
      fontFamily: 'PacFont',
      fontSize: "36px",
      color: "#facc15"
    }).setOrigin(0.5);

    this.levelSelectLayer.add(selectTitle);

    const btnStyle = {
      fontFamily: 'PacFont',
      fontSize: "18px",
      color: "#e2e8f0",
      padding: { x: 15, y: 12 },
      backgroundColor: "#1e293b",
    };

    // Dynamically list all registered levels
    const levels = Object.keys(window.GameLevels || {}).map(Number).sort((a, b) => a - b);
    levels.forEach((lvl, index) => {
      const yPos = cy - 100 + (index * 55);
      const lvlBtn = this.add.text(cx, yPos, `Level ${lvl}`, btnStyle)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      lvlBtn.on("pointerover", () => lvlBtn.setBackgroundColor("#334155").setColor("#facc15"));
      lvlBtn.on("pointerout", () => lvlBtn.setBackgroundColor("#1e293b").setColor("#e2e8f0"));
      lvlBtn.on("pointerdown", () => {
        this.scene.start("GameScene", {
          level: lvl,
          score: 0,
          highScore: this.highScore,
          lives: 3
        });
      });
      this.levelSelectLayer.add(lvlBtn);
    });

    const backBtn = this.add.text(cx, cy + 200, "Back", {
      fontFamily: 'PacFont',
      fontSize: "18px",
      color: "#94a3b8"
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    backBtn.on("pointerdown", () => {
      this.levelSelectLayer.setVisible(false);
      this.menuLayer.setVisible(true);
    });

    this.levelSelectLayer.add(backBtn);
  }

  _removeVideo() {
    if (this._videoEl) {
      this._videoEl.pause();
      this._videoEl.remove();
      this._videoEl = null;
    }
    if (this._audioCtx) {
      this._audioCtx.close();
      this._audioCtx = null;
    }
  }

  shutdown() {
    this._removeVideo();
  }
}
