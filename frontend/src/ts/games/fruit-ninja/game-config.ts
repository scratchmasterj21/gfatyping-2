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
  bombChance: number;
};

export const FRUIT_NINJA_DIFFICULTIES: GameDifficulty[] = [
  {
    label: "Easy",
    baseSpeed: 400,
    speedIncrement: 30,
    perWaveBase: 3,
    bombChance: 0.07,
  },
  {
    label: "Medium",
    baseSpeed: 470,
    speedIncrement: 45,
    perWaveBase: 5,
    bombChance: 0.1,
  },
  {
    label: "Hard",
    baseSpeed: 540,
    speedIncrement: 60,
    perWaveBase: 7,
    bombChance: 0.15,
  },
];

export async function createFruitNinjaGame(
  parent: HTMLElement,
  words: string[],
  difficulty: GameDifficulty = FRUIT_NINJA_DIFFICULTIES[0] as GameDifficulty,
  maxWave = 0,
): Promise<Phaser.Game> {
  const PhaserLib = await import("phaser");
  const P = PhaserLib.default;

  const game = new P.Game({
    type: P.AUTO,
    parent,
    backgroundColor: "#8b4513",
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
  game.registry.set("bombChance", difficulty.bombChance);
  game.registry.set("maxWave", maxWave);
  return game;
}
