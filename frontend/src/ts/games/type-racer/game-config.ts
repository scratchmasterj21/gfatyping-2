import type Phaser from "phaser";

export async function createTypeRacerGame(
  parent: HTMLElement,
  words: string[],
  cpuWpm = 35,
): Promise<Phaser.Game> {
  const PhaserLib = await import("phaser");
  const [{ BootScene }, { GameOverScene }, { GameScene }] = await Promise.all([
    import("./scenes/BootScene"),
    import("./scenes/GameOverScene"),
    import("./scenes/GameScene"),
  ]);
  const P = PhaserLib.default;

  const game = new P.Game({
    type: P.AUTO,
    parent,
    backgroundColor: "#080816",
    scale: {
      mode: P.Scale.RESIZE,
      autoCenter: P.Scale.CENTER_BOTH,
      width: parent.clientWidth || 800,
      height: parent.clientHeight || 500,
    },
    scene: [BootScene, GameScene, GameOverScene],
  });

  game.registry.set("words", words);
  game.registry.set("cpuWpm", cpuWpm);
  return game;
}
