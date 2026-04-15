class GameOverScene extends Phaser.Scene {
  constructor() {
    super("GameOverScene");
  }

  init(data) {
    this.score = data.score || 0;
    this.level = data.level || 1;
    this.highScore = data.highScore || Number(window.localStorage.getItem("pacMemeHighScore") || 0);
  }

  create() {
    const cx = this.scale.width / 2;
    const cy = (this.scale.height - 60) / 2;

    this.add.rectangle(cx, cy, 460, 260, 0x020617, 0.88)
      .setStrokeStyle(2, 0x38bdf8, 0.9)
      .setDepth(8);

    this.add.text(cx, cy - 60, "Game Over", {
      fontFamily: "Trebuchet MS",
      fontSize: "40px",
      color: "#f8fafc",
    }).setOrigin(0.5).setDepth(9);

    this.add.text(cx, cy - 10, `Score: ${this.score}`, {
      fontFamily: "Trebuchet MS",
      fontSize: "24px",
      color: "#e2e8f0",
    }).setOrigin(0.5).setDepth(9);

    const tryAgainBtn = this.add.text(cx - 90, cy + 60, "Try Again", {
      fontFamily: "Trebuchet MS",
      fontSize: "24px",
      color: "#bae6fd",
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setDepth(9);

    const newGameBtn = this.add.text(cx + 90, cy + 60, "New Game", {
      fontFamily: "Trebuchet MS",
      fontSize: "24px",
      color: "#facc15",
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setDepth(9);

    tryAgainBtn.on("pointerover", () => tryAgainBtn.setTint(0x38bdf8));
    tryAgainBtn.on("pointerout", () => tryAgainBtn.clearTint());
    tryAgainBtn.on("pointerdown", () => {
      this.scene.start("GameScene", {
        level: this.level,
        score: 0,
        highScore: this.highScore,
        lives: 3
      });
    });

    newGameBtn.on("pointerover", () => newGameBtn.setTint(0x38bdf8));
    newGameBtn.on("pointerout", () => newGameBtn.clearTint());
    newGameBtn.on("pointerdown", () => {
      this.scene.start("GameScene", {
        level: 1,
        score: 0,
        highScore: this.highScore,
        lives: 3
      });
    });
  }
}
