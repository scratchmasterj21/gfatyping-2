import { JSXElement } from "solid-js";

import { Fa } from "../../components/common/Fa";
import { muted, setMuted } from "./mini-sounds";

/** Round sound on/off toggle for the mini games. */
export function MuteButton(props: { class?: string }): JSXElement {
  return (
    <button
      type="button"
      class={
        props.class ??
        "flex h-11 w-11 items-center justify-center rounded-full bg-sub-alt text-text hover:bg-text hover:text-bg"
      }
      aria-label={muted() ? "Turn sound on" : "Turn sound off"}
      aria-pressed={!muted()}
      onClick={() => setMuted(!muted())}
    >
      <Fa icon={muted() ? "fa-volume-mute" : "fa-volume-up"} />
    </button>
  );
}
