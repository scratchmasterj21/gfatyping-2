import type Phaser from "phaser";

export type GameDifficulty = {
  label: string;
  baseSpeed: number;
  speedIncrement: number;
  perWaveBase: number;
  hordeEnabled: boolean;
  /**
   * How close (vertically) the player needs to patrol to see/type a ghost on
   * their faced side - a large value means the whole lawn is always
   * "in range" so a beginner only has to learn facing, not facing+patrolling
   * at the same time.
   */
  targetYRange: number;
};

export const GHOST_DIFFICULTIES: GameDifficulty[] = [
  {
    label: "Easy",
    baseSpeed: 20,
    speedIncrement: 3,
    perWaveBase: 2,
    hordeEnabled: false,
    targetYRange: 999, // whole lawn always in range - just face the right side and type
  },
  {
    label: "Medium",
    baseSpeed: 42,
    speedIncrement: 8,
    perWaveBase: 4,
    hordeEnabled: true,
    targetYRange: 90,
  },
  {
    label: "Hard",
    baseSpeed: 68,
    speedIncrement: 14,
    perWaveBase: 7,
    hordeEnabled: true,
    targetYRange: 55,
  },
];

export async function createGhostHunterGame(
  parent: HTMLElement,
  words: string[],
  difficulty: GameDifficulty = GHOST_DIFFICULTIES[0] as GameDifficulty,
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
    backgroundColor: "#0d0022",
    scale: {
      mode: P.Scale.RESIZE,
      autoCenter: P.Scale.CENTER_BOTH,
      width: parent.clientWidth || 800,
      height: parent.clientHeight || 500,
    },
    scene: [BootScene, GameScene, UIScene, GameOverScene],
  });

  game.registry.set("words", words);
  game.registry.set("baseSpeed", difficulty.baseSpeed);
  game.registry.set("speedIncrement", difficulty.speedIncrement);
  game.registry.set("perWaveBase", difficulty.perWaveBase);
  game.registry.set("hordeEnabled", difficulty.hordeEnabled);
  game.registry.set("targetYRange", difficulty.targetYRange);
  game.registry.set("maxWave", maxWave);
  return game;
}
