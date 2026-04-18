GameScene.prototype.updateFireProjectiles = function updateFireProjectiles(delta) {
  if (this.fireProjectiles.length === 0) return;

  const remaining = [];

  for (const projectile of this.fireProjectiles) {
    if (!projectile.sprite.active) {
      continue;
    }

    const move = projectile.speed * (delta / 1000);
    projectile.sprite.x += projectile.direction.x * move;
    projectile.sprite.y += projectile.direction.y * move;

    const cellX = this.worldToCell(projectile.sprite.x, this.boardOffsetX);
    const cellY = this.worldToCell(projectile.sprite.y, this.boardOffsetY);
    if (!this.canMove(cellX, cellY)) {
      projectile.sprite.destroy();
      continue;
    }

    const dist = Phaser.Math.Distance.Between(
      this.playerAgent.sprite.x,
      this.playerAgent.sprite.y,
      projectile.sprite.x,
      projectile.sprite.y
    );
    if (!this.invulnerable && dist < this.tileSize * 0.55) {
      projectile.sprite.destroy();
      this.handlePlayerCaught();
      return;
    }

    remaining.push(projectile);
  }

  this.fireProjectiles = remaining;
};

GameScene.prototype.updateCricketBalls = function updateCricketBalls(delta) {
  if (this.cricketBalls.length === 0) return;

  const remaining = [];

  for (const ball of this.cricketBalls) {
    if (!ball.sprite.active) {
      continue;
    }

    const move = ball.speed * (delta / 1000);
    ball.sprite.x += ball.direction.x * move;
    ball.sprite.y += ball.direction.y * move;
    ball.sprite.angle += 720 * (delta / 1000);

    const cellX = this.worldToCell(ball.sprite.x, this.boardOffsetX);
    const cellY = this.worldToCell(ball.sprite.y, this.boardOffsetY);
    if (!this.canMove(cellX, cellY)) {
      ball.sprite.destroy();
      continue;
    }

    const dist = Phaser.Math.Distance.Between(
      this.playerAgent.sprite.x,
      this.playerAgent.sprite.y,
      ball.sprite.x,
      ball.sprite.y
    );
    if (!this.invulnerable && dist < this.tileSize * 0.55) {
      ball.sprite.destroy();
      this.handlePlayerCaught();
      return;
    }

    remaining.push(ball);
  }

  this.cricketBalls = remaining;
};

GameScene.prototype.spawnFireProjectile = function spawnFireProjectile(hunter, direction) {
  const projectile = this.add.sprite(
    hunter.sprite.x + direction.x * (this.tileSize * 0.7),
    hunter.sprite.y + direction.y * (this.tileSize * 0.7),
    "fire_projectile"
  ).setDepth(5);

  projectile.setDisplaySize(32, 42);
  projectile.setAngle(this.getDirectionAngle(direction));
  projectile.play("fire-burn");

  this.fireProjectiles.push({
    sprite: projectile,
    direction: { ...direction },
    speed: 260,
  });
};

GameScene.prototype.spawnCricketBallProjectile = function spawnCricketBallProjectile(hunter, direction) {
  const projectile = this.add.sprite(
    hunter.sprite.x + direction.x * (this.tileSize * 0.7),
    hunter.sprite.y + direction.y * (this.tileSize * 0.7),
    "cricket_ball"
  ).setDepth(5);

  projectile.setDisplaySize(22, 22);

  this.cricketBalls.push({
    sprite: projectile,
    direction: { ...direction },
    speed: 300,
  });
};

GameScene.prototype.clearFireProjectiles = function clearFireProjectiles() {
  for (const projectile of this.fireProjectiles) {
    if (projectile.sprite?.active) {
      projectile.sprite.destroy();
    }
  }
  this.fireProjectiles = [];
};

GameScene.prototype.clearCricketBalls = function clearCricketBalls() {
  for (const ball of this.cricketBalls) {
    if (ball.sprite?.active) {
      ball.sprite.destroy();
    }
  }
  this.cricketBalls = [];
};
