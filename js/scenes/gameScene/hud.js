GameScene.prototype.createHud = function createHud() {
  this.hudStyle = {
    fontFamily: 'PacFont',
    fontSize: "20px",
    color: "#e2e8f0",
    stroke: "#020617",
    strokeThickness: 4,
  };

  const hudY = this.scale.height - 40;
  this.scoreText = this.add.text(this.boardOffsetX, hudY, "", this.hudStyle).setDepth(6);
  this.levelText = this.add.text(this.scale.width / 2 - 48, hudY, "", this.hudStyle).setDepth(6);

  this.livesIcons = [];
  const livesStartX = this.boardOffsetX + this.gridWidth * this.tileSize - 120;
  for (let i = 0; i < 3; i++) {
    const heart = this.add.image(livesStartX + i * 40, hudY + 13, "heart").setDepth(6);
    this.livesIcons.push(heart);
  }

  const centerY = this.boardOffsetY + (this.gridHeight * this.tileSize) / 2;
  this.noticeText = this.add
    .text(this.scale.width / 2, centerY, "", {
      fontFamily: "Trebuchet MS",
      fontSize: "34px",
      color: "#f8fafc",
      stroke: "#020617",
      strokeThickness: 6,
    })
    .setDepth(7)
    .setOrigin(0.5)
    .setVisible(false);

  this.refreshHud();
};

GameScene.prototype.refreshHud = function refreshHud() {
  this.scoreText.setText(`Score: ${this.score}`);
  this.levelText.setText(`Level: ${this.level}`);

  this.livesIcons.forEach((icon, index) => {
    icon.setVisible(index < this.lives);
  });
};

GameScene.prototype.showNotice = function showNotice(message) {
  this.noticeText.setText(message);
  this.noticeText.setVisible(true);
  this.noticeText.setAlpha(1);

  this.tweens.add({
    targets: this.noticeText,
    alpha: 0,
    duration: 1000,
    delay: 250,
    onComplete: () => this.noticeText.setVisible(false),
  });
};
