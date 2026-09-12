import type Phaser from "phaser";

export async function createTypingRpgGame(
  parent: HTMLElement,
  words: string[],
): Promise<Phaser.Game> {
  const PhaserLib = await import("phaser");
  const [{ RpgScene }] = await Promise.all([import("./scenes/RpgScene")]);
  const P = PhaserLib.default;
  const game = new P.Game({
    type: P.AUTO,
    parent,
    backgroundColor: "#172c2b",
    scale: {
      mode: P.Scale.RESIZE,
      autoCenter: P.Scale.CENTER_BOTH,
      width: parent.clientWidth || 800,
      height: parent.clientHeight || 500,
    },
    scene: [RpgScene],
  });
  game.registry.set("rpgWords", words);
  return game;
}
