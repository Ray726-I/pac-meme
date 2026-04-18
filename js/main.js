const GAME_WIDTH = 760;
const GAME_HEIGHT = 820;

const config = {
  type: Phaser.AUTO,
  parent: "game-container",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#0f172a",
  pixelArt: true,
  physics: {
    default: "arcade",
    arcade: {
      debug: false,
    },
  },
  scene: [BootScene, TitleScene, StartScene, GameScene, GameOverScene, LevelClearedScene, GameWonScene],
};

window.game = new Phaser.Game(config);
