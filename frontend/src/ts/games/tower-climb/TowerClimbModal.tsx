import { JSXElement } from "solid-js";

import { MiniGameShell } from "../mini/MiniGameShell";
import { STREAK_FOR_DOUBLE, TOWER_DIFFICULTIES } from "./tower-rules";
import { TowerClimb } from "./TowerClimb";

export function TowerClimbModal(props: {
  open: boolean;
  onClose: () => void;
  onResult?: (score: number, wave: number) => void;
}): JSXElement {
  return (
    <MiniGameShell
      open={props.open}
      onClose={props.onClose}
      onResult={props.onResult}
      gameId="tower-climb"
      title="Tappy's Tower Climb"
      difficulties={TOWER_DIFFICULTIES}
      howToPlay={
        <>
          <p>
            Type the word on the next block to help Tappy climb one floor
            higher.
          </p>
          <p>
            {STREAK_FOR_DOUBLE} perfect words in a row = a double jump! Typos
            crack the block - three cracks and Tappy slides down.
          </p>
        </>
      }
      play={(p) => <TowerClimb {...p} />}
    />
  );
}
