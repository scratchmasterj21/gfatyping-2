import { JSXElement } from "solid-js";

import { MiniGameShell } from "../mini/MiniGameShell";
import { MAX_STRIKES, RUSH_AFTER, SNACK_DIFFICULTIES } from "./snack-rules";
import { SnackShop } from "./SnackShop";

export function SnackShopModal(props: {
  open: boolean;
  onClose: () => void;
  onResult?: (score: number, wave: number) => void;
}): JSXElement {
  return (
    <MiniGameShell
      open={props.open}
      onClose={props.onClose}
      onResult={props.onResult}
      gameId="snack-shop"
      title="Snack Shop"
      difficulties={SNACK_DIFFICULTIES}
      howToPlay={
        <>
          <p>
            Customers line up with orders. Type each order exactly before their
            patience runs out.
          </p>
          <p>
            Serve {RUSH_AFTER} in a row for rush hour (double points). If{" "}
            {MAX_STRIKES} customers leave, the shop closes!
          </p>
        </>
      }
      play={(p) => <SnackShop {...p} />}
    />
  );
}
