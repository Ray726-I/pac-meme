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

    // Load image first to get natural aspect ratio
    const tmpImg = new Image();
    tmpImg.src = "assets/congrats.png";

    const render = (naturalW, naturalH) => {
      const aspect = naturalH / naturalW;

      // 15% wider than canvas on each side = 130% total width
      const imgW = Math.round(rect.width * 1.30);
      const imgH = Math.round(imgW * aspect);            // correct ratio
      const imgX = Math.round(rect.left + (rect.width - imgW) / 2); // centered horizontally
      const imgY = Math.round(rect.top  + (rect.height - imgH) / 2); // centered vertically

      // ── Congrats image ────────────────────────────────────────────────────
      const img = document.createElement("img");
      img.src = "assets/congrats.png";
      img.style.position      = "fixed";
      img.style.left          = imgX + "px";
      img.style.top           = imgY + "px";
      img.style.width         = imgW + "px";
      img.style.height        = imgH + "px";
      img.style.zIndex        = "8000";
      img.style.objectFit     = "fill"; // exact pixel fit since we calculated size
      img.style.pointerEvents = "none";
      document.body.appendChild(img);
      this._domElements.push(img);

      // ── UI panel — centred in the white space of the image ───────────────
      // White space is roughly the vertical middle 30% of the image
      const imgCenterX = imgX + imgW / 2;
      const imgCenterY = imgY + imgH / 2;

      const panelW  = Math.round(imgW * 0.30);

      const panel = document.createElement("div");
      panel.style.position      = "fixed";
      panel.style.left          = (imgCenterX - panelW / 2) + "px";
      panel.style.top           = (imgCenterY - 90) + "px";
      panel.style.width         = panelW + "px";
      panel.style.zIndex        = "8001";
      panel.style.display       = "flex";
      panel.style.flexDirection = "column";
      panel.style.alignItems    = "center";
      panel.style.gap           = "16px";
      panel.style.fontFamily    = "'PacFont', monospace";

      // "PLAY AGAIN?" heading
      const heading = document.createElement("div");
      heading.textContent          = "PLAY AGAIN?";
      heading.style.fontSize       = "26px";
      heading.style.color          = "#1e293b";
      heading.style.fontWeight     = "bold";
      heading.style.letterSpacing  = "2px";
      heading.style.textShadow     = "0 1px 2px rgba(0,0,0,0.25)";
      panel.appendChild(heading);

      // Score line
      const scoreLine = document.createElement("div");
      scoreLine.textContent    = `Score: ${this.score}`;
      scoreLine.style.fontSize = "14px";
      scoreLine.style.color    = "#475569";
      panel.appendChild(scoreLine);

      // Buttons row
      const btnRow = document.createElement("div");
      btnRow.style.display = "flex";
      btnRow.style.gap     = "20px";

      const yesBtn = this._makeBtn("YES", true);
      yesBtn.addEventListener("click", () => {
        this._cleanup();
        this.scene.start("StartScene");
      });

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
    };

    if (tmpImg.complete && tmpImg.naturalWidth) {
      render(tmpImg.naturalWidth, tmpImg.naturalHeight);
    } else {
      tmpImg.onload = () => render(tmpImg.naturalWidth, tmpImg.naturalHeight);
      // Fallback if naturalWidth never fires (e.g. cached race condition)
      tmpImg.onerror = () => render(800, 600);
    }
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
