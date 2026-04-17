class StartScene extends Phaser.Scene {
  constructor() {
    super("StartScene");
  }

  create() {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    const startLevel = (level) => {
      this.scene.start("GameScene", {
        level,
        score: 0,
        highScore: Number(window.localStorage.getItem("pacMemeHighScore") || 0),
        lives: 3,
      });
    };

    this.add.text(cx, cy - 160, "Select Level", {
      fontFamily: 'PacFont',
      fontSize: "42px",
      color: "#facc15",
      stroke: "#020617",
      strokeThickness: 8,
    }).setOrigin(0.5);

    const levels = Object.keys(window.GameLevels || {}).map(Number).sort((a, b) => a - b);

    levels.forEach((lvl, index) => {
      const yPos = cy - 70 + (index * 55);
      const btn = this.add.text(cx, yPos, `Level ${lvl}`, {
        fontFamily: 'PacFont',
        fontSize: "26px",
        color: "#e2e8f0",
        stroke: "#020617",
        strokeThickness: 5,
        padding: { x: 20, y: 8 },
        backgroundColor: "#1e293b",
      })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      btn.on("pointerover", () => btn.setBackgroundColor("#334155").setColor("#facc15"));
      btn.on("pointerout", () => btn.setBackgroundColor("#1e293b").setColor("#e2e8f0"));
      btn.on("pointerdown", () => startLevel(lvl));
    });
  }
}
