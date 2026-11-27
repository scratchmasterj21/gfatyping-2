import { JSXElement } from "solid-js";

import { MiniGameShell } from "../mini/MiniGameShell";
import { STREAK_AFTER, ZOO_DIFFICULTIES } from "./zoo-shift-rules";
import { ZooShift } from "./ZooShift";

export function ZooShiftModal(props: {
  open: boolean;
  onClose: () => void;
  onResult?: (score: number, wave: number) => void;
  initialMode?: "solo" | "together";
  /** Medium/Hard need All Keys (teacher setting); the reason, when locked. */
  hardLock?: string;
}): JSXElement {
  return (
    <MiniGameShell
      open={props.open}
      onClose={props.onClose}
      onResult={props.onResult}
      initialMode={props.initialMode}
      raceDurationSec={(d) => d.seconds + 5}
      gameId="zoo-keeper"
      title="Zoo Keeper"
      difficulties={ZOO_DIFFICULTIES}
      usesWordList={false}
      levelWords
      difficultyLock={(d) => (d.level === 0 ? undefined : props.hardLock)}
      tips={[
        "🐾 Type the word in an animal's bubble",
        "🔥 Streaks = double points",
        "😢 Don't keep them waiting",
      ]}
      howToPlay={
        <>
          <p>
            The zoo animals need you! When an animal asks for something, type
            the word in its bubble to look after it.
          </p>
          <p>
            Help {STREAK_AFTER} in a row for a happy streak (double points). If
            an animal waits too long it gets sad, so be quick!
          </p>
        </>
      }
      play={(p) => <ZooShift {...p} />}
    />
  );
}
