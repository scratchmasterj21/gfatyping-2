import type Phaser from "phaser";

export type GameDifficulty = {
  label: string;
  baseSpeed: number;
  speedIncrement: number;
  perWaveBase: number;
  bossEnabled: boolean;
};

export const DEFENDER_DIFFICULTIES: GameDifficulty[] = [
  {
    label: "Easy",
    baseSpeed: 20,
    speedIncrement: 4,
    perWaveBase: 4,
    bossEnabled: true,
  },
  {
    label: "Medium",
    baseSpeed: 38,
    speedIncrement: 8,
    perWaveBase: 6,
    bossEnabled: true,
  },
  {
    label: "Hard",
    baseSpeed: 55,
    speedIncrement: 12,
    perWaveBase: 8,
    bossEnabled: true,
  },
];

export async function createWordDefenderGame(
  parent: HTMLElement,
  words: string[],
  difficulty: GameDifficulty = DEFENDER_DIFFICULTIES[0] as GameDifficulty,
  maxWave = 0,
): Promise<Phaser.Game> {
  const PhaserLib = await import("phaser");
  const [{ BootScene }, { GameOverScene }, { GameScene }, { UIScene }] =
    await Promise.all([
      import("./scenes/BootScene"),
      import("./scenes/GameOverScene"),
      import("./scenes/GameScene"),
      import("./scenes/UIScene"),
    ]);
  const P = PhaserLib.default;

  const game = new P.Game({
    type: P.AUTO,
    parent,
    backgroundColor: "#0a0a1a",
    scale: {
      mode: P.Scale.RESIZE,
      autoCenter: P.Scale.CENTER_BOTH,
      width: parent.clientWidth || 800,
      height: parent.clientHeight || 500,
    },
    physics: {
      default: "arcade",
      arcade: { gravity: { x: 0, y: 0 }, debug: false },
    },
    scene: [BootScene, GameScene, UIScene, GameOverScene],
  });

  game.registry.set("words", words);
  game.registry.set("baseSpeed", difficulty.baseSpeed);
  game.registry.set("speedIncrement", difficulty.speedIncrement);
  game.registry.set("perWaveBase", difficulty.perWaveBase);
  game.registry.set("bossEnabled", difficulty.bossEnabled);
  game.registry.set("maxWave", maxWave);
  return game;
}
