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

    this.add.text(cx, cy - 80, "Pac-Meme", {
      fontFamily: 'PacFont',
      fontSize: "56px",
      color: "#facc15",
      stroke: "#020617",
      strokeThickness: 8,
    }).setOrigin(0.5);

    const playBtn = this.add.text(cx, cy + 24, "Play Level 1", {
      fontFamily: 'PacFont',
      fontSize: "34px",
      color: "#f8fafc",
      stroke: "#020617",
      strokeThickness: 6,
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const playLevel2Btn = this.add.text(cx, cy + 90, "Play Another Level (2)", {
      fontFamily: 'PacFont',
      fontSize: "26px",
      color: "#bae6fd",
      stroke: "#020617",
      strokeThickness: 5,
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    playBtn.on("pointerover", () => playBtn.setColor("#60a5fa"));
    playBtn.on("pointerout", () => playBtn.setColor("#f8fafc"));
    playBtn.on("pointerdown", () => startLevel(1));

    playLevel2Btn.on("pointerover", () => playLevel2Btn.setColor("#38bdf8"));
    playLevel2Btn.on("pointerout", () => playLevel2Btn.setColor("#bae6fd"));
    playLevel2Btn.on("pointerdown", () => startLevel(2));
  }
}
