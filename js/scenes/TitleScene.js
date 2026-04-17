class TitleScene extends Phaser.Scene {
  constructor() {
    super("TitleScene");
    this._videoEl = null;
  }

  create() {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    this.mainContainer = this.add.container(0, 0);
    this.rulesContainer = this.add.container(0, 0).setVisible(false);

    // --- Main Menu Container ---

    const titleText = this.add.text(cx, cy - 100, "Pac-Meme", {
      fontFamily: 'PacFont',
      fontSize: "64px",
      color: "#facc15",
      stroke: "#020617",
      strokeThickness: 8,
    }).setOrigin(0.5);

    const playBtn = this.add.text(cx, cy + 20, "Play Game", {
      fontFamily: 'PacFont',
      fontSize: "36px",
      color: "#f8fafc",
      stroke: "#020617",
      strokeThickness: 6,
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const rulesBtn = this.add.text(cx, cy + 100, "Rules", {
      fontFamily: 'PacFont',
      fontSize: "36px",
      color: "#bae6fd",
      stroke: "#020617",
      strokeThickness: 5,
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    playBtn.on("pointerover", () => playBtn.setColor("#60a5fa"));
    playBtn.on("pointerout", () => playBtn.setColor("#f8fafc"));
    playBtn.on("pointerdown", () => this.playIntroVideo());

    rulesBtn.on("pointerover", () => rulesBtn.setColor("#38bdf8"));
    rulesBtn.on("pointerout", () => rulesBtn.setColor("#bae6fd"));
    rulesBtn.on("pointerdown", () => this.showRules());

    this.mainContainer.add([titleText, playBtn, rulesBtn]);


    // --- Rules Container ---

    const rulesTitle = this.add.text(cx, 80, "Rules", {
      fontFamily: 'PacFont',
      fontSize: "48px",
      color: "#facc15"
    }).setOrigin(0.5);

    this.rulesContainer.add(rulesTitle);

    // Player
    const pSprite = this.add.sprite(150, 180, "player_idle").setDisplaySize(48, 48);
    const pText = this.add.text(200, 180, "Eat pellets. Run from Memes.", {
      fontFamily: 'PacFont', fontSize: "16px", color: "#fff", wordWrap: { width: 500 }
    }).setOrigin(0, 0.5);
    
    // Chin Tapak
    const cSprite = this.add.sprite(150, 260, "chin_tapak").setDisplaySize(48, 48);
    const cText = this.add.text(200, 260, "Teleports near you suddenly!", {
      fontFamily: 'PacFont', fontSize: "16px", color: "#fff"
    }).setOrigin(0, 0.5);

    // Max 
    const mSprite = this.add.sprite(150, 340, "max_hunter").setDisplaySize(48, 48);
    const mText = this.add.text(200, 340, "Sprints super fast!", {
      fontFamily: 'PacFont', fontSize: "16px", color: "#fff"
    }).setOrigin(0, 0.5);

    // Aag
    const aSprite = this.add.sprite(150, 420, "amitabh_aag").setDisplaySize(48, 48);
    const aText = this.add.text(200, 420, "Shoots fireballs straight ahead!", {
      fontFamily: 'PacFont', fontSize: "16px", color: "#fff"
    }).setOrigin(0, 0.5);

    this.rulesContainer.add([pSprite, pText, cSprite, cText, mSprite, mText, aSprite, aText]);

    const backBtn = this.add.text(cx, cy + 280, "Back", {
      fontFamily: 'PacFont',
      fontSize: "28px",
      color: "#f8fafc",
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    backBtn.on("pointerover", () => backBtn.setColor("#60a5fa"));
    backBtn.on("pointerout", () => backBtn.setColor("#f8fafc"));
    backBtn.on("pointerdown", () => this.hideRules());

    this.rulesContainer.add(backBtn);
  }

  showRules() {
    this.mainContainer.setVisible(false);
    this.rulesContainer.setVisible(true);
  }

  hideRules() {
    this.rulesContainer.setVisible(false);
    this.mainContainer.setVisible(true);
  }

  playIntroVideo() {
    this.mainContainer.setVisible(false); // Hide everything while video plays

    const canvas = this.sys.game.canvas;
    const rect = canvas.getBoundingClientRect();

    const vid = document.createElement("video");
    vid.src = "assets/chaliye-shuru-karte-hai-video-meme-download.mp4";
    vid.autoplay = true;
    vid.loop = false;
    vid.muted = false;
    vid.playsInline = true;
    vid.style.position = "fixed";
    vid.style.left = rect.left + "px";
    vid.style.top = rect.top + "px";
    vid.style.width = rect.width + "px";
    vid.style.height = rect.height + "px";
    vid.style.zIndex = "9999";
    vid.style.backgroundColor = "black";
    vid.style.objectFit = "contain";

    document.body.appendChild(vid);
    this._videoEl = vid;

    vid.onended = () => {
      this._removeVideo();
      this.scene.start("StartScene");
    };
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
