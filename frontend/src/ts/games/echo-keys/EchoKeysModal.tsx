import { JSXElement } from "solid-js";

import { MiniGameShell } from "../mini/MiniGameShell";
import { ECHO_DIFFICULTIES, ECHO_LIVES } from "./echo-rules";
import { EchoKeys } from "./EchoKeys";

export function EchoKeysModal(props: {
  open: boolean;
  onClose: () => void;
  onResult?: (score: number, wave: number) => void;
}): JSXElement {
  return (
    <MiniGameShell
      open={props.open}
      onClose={props.onClose}
      onResult={props.onResult}
      gameId="echo-keys"
      title="Echo Keys"
      difficulties={ECHO_DIFFICULTIES}
      usesWordList={false}
      howToPlay={
        <>
          <p>
            Watch Tappy light up some keys, then type the same keys in the same
            order.
          </p>
          <p>
            Each pattern is one key longer. Colors show which finger to use. You
            have {ECHO_LIVES} lives.
          </p>
        </>
      }
      play={(p) => <EchoKeys {...p} />}
    />
  );
}
