import type Phaser from "phaser";

import { BootScene } from "./scenes/BootScene";
import { GameOverScene } from "./scenes/GameOverScene";
import { GameScene } from "./scenes/GameScene";
import { UIScene } from "./scenes/UIScene";

export type GameDifficulty = {
  label: string;
  cols: number;
  time: number;
};

export const TYPE_TOSS_DIFFICULTIES: GameDifficulty[] = [
  { label: "Easy", cols: 2, time: 90 },
  { label: "Medium", cols: 3, time: 60 },
  { label: "Hard", cols: 4, time: 45 },
];

export async function createTypeTossGame(
  parent: HTMLElement,
  words: string[],
  difficulty: GameDifficulty = TYPE_TOSS_DIFFICULTIES[1] as GameDifficulty,
): Promise<Phaser.Game> {
  const PhaserLib = await import("phaser");
  const P = PhaserLib.default;

  const game = new P.Game({
    type: P.AUTO,
    parent,
    backgroundColor: "#b5651d",
    scale: {
      mode: P.Scale.RESIZE,
      autoCenter: P.Scale.CENTER_BOTH,
      width: parent.clientWidth || 800,
      height: parent.clientHeight || 500,
    },
    scene: [BootScene, GameScene, UIScene, GameOverScene],
  });

  game.registry.set("words", words);
  game.registry.set("cols", difficulty.cols);
  game.registry.set("time", difficulty.time);
  return game;
}
