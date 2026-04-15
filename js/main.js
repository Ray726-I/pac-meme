const GAME_WIDTH = 640;
const GAME_HEIGHT = 700;

const config = {
  type: Phaser.AUTO,
  parent: "game-container",
  width: 640,
  height: 700,
  backgroundColor: "#0f172a",
  pixelArt: true,
  physics: {
    default: "arcade",
    arcade: {
      debug: false,
    },
  },
  scene: [BootScene, StartScene, GameScene, GameOverScene],
};

new Phaser.Game(config);
