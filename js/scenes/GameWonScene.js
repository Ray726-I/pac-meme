class GameWonScene extends Phaser.Scene {
  constructor() {
    super("GameWonScene");
    this._domElements = [];
  }

  init(data) {
    this.score = data.score || 0;
    this.highScore = data.highScore || 0;
    this.level = data.level || 5;
    this.lives = data.lives || 3;
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    // Dark backdrop (Phaser canvas)
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000).setDepth(0);

    this._buildOverlay();
  }

  _buildOverlay() {
    const canvas = this.sys.game.canvas;
    const rect = canvas.getBoundingClientRect();

    // Image bleeds 12% beyond canvas on every side
    const bleed = 0.12;
    const imgW = Math.round(rect.width  * (1 + bleed * 2));
    const imgH = Math.round(rect.height * (1 + bleed * 2));
    const imgX = Math.round(rect.left   - rect.width  * bleed);
    const imgY = Math.round(rect.top    - rect.height * bleed);

    // ── Congrats image ──────────────────────────────────────────────────────
    const img = document.createElement("img");
    img.src = "assets/congrats.png";
    img.style.position = "fixed";
    img.style.left     = imgX + "px";
    img.style.top      = imgY + "px";
    img.style.width    = imgW + "px";
    img.style.height   = imgH + "px";
    img.style.zIndex   = "8000";
    img.style.objectFit = "fill";
    img.style.pointerEvents = "none";
    document.body.appendChild(img);
    this._domElements.push(img);

    // ── UI panel centred in the white space ─────────────────────────────────
    // The white gap in congrats.png is roughly the middle 30% vertically
    // and spans the centre horizontally.
    const panelW  = Math.round(rect.width * 0.38);
    const panelCX = Math.round(rect.left + rect.width / 2);
    const panelCY = Math.round(rect.top  + rect.height * 0.50); // tweak if needed

    const panel = document.createElement("div");
    panel.style.position        = "fixed";
    panel.style.left            = (panelCX - panelW / 2) + "px";
    panel.style.top             = (panelCY - 100) + "px";
    panel.style.width           = panelW + "px";
    panel.style.zIndex          = "8001";
    panel.style.display         = "flex";
    panel.style.flexDirection   = "column";
    panel.style.alignItems      = "center";
    panel.style.gap             = "18px";
    panel.style.fontFamily      = "'PacFont', monospace";

    // "PLAY AGAIN?" heading
    const heading = document.createElement("div");
    heading.textContent     = "PLAY AGAIN?";
    heading.style.fontSize  = "28px";
    heading.style.color     = "#1e293b";
    heading.style.fontWeight = "bold";
    heading.style.letterSpacing = "2px";
    heading.style.textShadow = "0 1px 2px rgba(0,0,0,0.25)";
    panel.appendChild(heading);

    // Score line
    const scoreLine = document.createElement("div");
    scoreLine.textContent   = `Score: ${this.score}`;
    scoreLine.style.fontSize = "15px";
    scoreLine.style.color   = "#475569";
    panel.appendChild(scoreLine);

    // Buttons row
    const btnRow = document.createElement("div");
    btnRow.style.display = "flex";
    btnRow.style.gap     = "24px";

    // YES button (highlighted)
    const yesBtn = this._makeBtn("YES", true);
    yesBtn.addEventListener("click", () => {
      this._cleanup();
      this.scene.start("GameScene", {
        level: 1,
        score: 0,
        highScore: this.highScore,
        lives: 3,
      });
    });

    // NO button
    const noBtn = this._makeBtn("NO", false);
    noBtn.addEventListener("click", () => {
      this._cleanup();
      this.scene.start("TitleScene");
    });

    btnRow.appendChild(yesBtn);
    btnRow.appendChild(noBtn);
    panel.appendChild(btnRow);

    document.body.appendChild(panel);
    this._domElements.push(panel);
  }

  _makeBtn(label, highlighted) {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.style.fontFamily    = "'PacFont', monospace";
    btn.style.fontSize      = "20px";
    btn.style.padding       = "10px 28px";
    btn.style.border        = "none";
    btn.style.borderRadius  = "8px";
    btn.style.cursor        = "pointer";
    btn.style.transition    = "transform 0.1s, box-shadow 0.1s";
    btn.style.zIndex        = "8002";

    if (highlighted) {
      btn.style.background   = "#4ade80";
      btn.style.color        = "#0f172a";
      btn.style.boxShadow    = "0 0 14px rgba(74,222,128,0.6)";
      btn.style.fontWeight   = "bold";
    } else {
      btn.style.background   = "#e2e8f0";
      btn.style.color        = "#475569";
      btn.style.boxShadow    = "0 2px 6px rgba(0,0,0,0.15)";
    }

    btn.addEventListener("mouseenter", () => {
      btn.style.transform  = "scale(1.08)";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.transform  = "scale(1)";
    });
    btn.addEventListener("mousedown", () => {
      btn.style.transform  = "scale(0.96)";
    });

    return btn;
  }

  _cleanup() {
    this._domElements.forEach(el => el.remove());
    this._domElements = [];
  }

  shutdown() {
    this._cleanup();
  }
}
