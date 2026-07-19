import type Phaser from "phaser";

import { BootScene } from "./scenes/BootScene";
import { GameOverScene } from "./scenes/GameOverScene";
import { GameScene } from "./scenes/GameScene";
import { UIScene } from "./scenes/UIScene";

export type GameDifficulty = {
  label: string;
  baseSpeed: number;
  speedIncrement: number;
  perWaveBase: number;
  hordeEnabled: boolean;
};

export const BALLOON_DIFFICULTIES: GameDifficulty[] = [
  {
    label: "Easy",
    baseSpeed: 15,
    speedIncrement: 3,
    perWaveBase: 4,
    hordeEnabled: false,
  },
  {
    label: "Medium",
    baseSpeed: 28,
    speedIncrement: 6,
    perWaveBase: 5,
    hordeEnabled: true,
  },
  {
    label: "Hard",
    baseSpeed: 42,
    speedIncrement: 10,
    perWaveBase: 7,
    hordeEnabled: true,
  },
];

export async function createBalloonPopGame(
  parent: HTMLElement,
  words: string[],
  difficulty: GameDifficulty = BALLOON_DIFFICULTIES[0] as GameDifficulty,
  maxWave = 0,
): Promise<Phaser.Game> {
  const PhaserLib = await import("phaser");
  const P = PhaserLib.default;

  const game = new P.Game({
    type: P.AUTO,
    parent,
    backgroundColor: "#87ceeb",
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
  game.registry.set("maxWave", maxWave);
  return game;
}
