class StartScene extends Phaser.Scene {
  constructor() {
    super("StartScene");
  }

  create() {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    this.add.text(cx, cy - 80, "Pac-Meme", {
      fontFamily: "Trebuchet MS",
      fontSize: "56px",
      color: "#facc15",
      stroke: "#020617",
      strokeThickness: 8,
    }).setOrigin(0.5);

    const playBtn = this.add.text(cx, cy + 40, "Play", {
      fontFamily: "Trebuchet MS",
      fontSize: "36px",
      color: "#f8fafc",
      stroke: "#020617",
      strokeThickness: 6,
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    playBtn.on("pointerover", () => playBtn.setColor("#60a5fa"));
    playBtn.on("pointerout", () => playBtn.setColor("#f8fafc"));
    playBtn.on("pointerdown", () => {
      this.scene.start("GameScene", {
        level: 1,
        score: 0,
        highScore: Number(window.localStorage.getItem("pacMemeHighScore") || 0),
        lives: 3
      });
    });
  }
}
