const GAME_SIZE = 640;

const config = {
  type: Phaser.AUTO,
  parent: "game-container",
  width: GAME_SIZE,
  height: GAME_SIZE,
  backgroundColor: "#0f172a",
  pixelArt: true,
  physics: {
    default: "arcade",
    arcade: {
      debug: false,
    },
  },
  scene: [BootScene, GameScene],
};

new Phaser.Game(config);
