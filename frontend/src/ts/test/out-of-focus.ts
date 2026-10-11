import * as Misc from "../utils/misc";
import { Config } from "../config/store";
import { qs, qsa } from "../utils/dom";

const outOfFocusTimeouts: (number | NodeJS.Timeout)[] = [];

const messages = {
  default: "Click here or press any key to focus",
  window: "Click anywhere to focus the window",
};

const touchMessages: typeof messages = {
  default: "Tap here or press any key to type",
  window: "Tap anywhere to keep typing",
};

function isTouchScreen(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches
  );
}

export function hide(): void {
  qsa("#words, #compositionDisplay")
    ?.setStyle({ transition: "none" })
    ?.removeClass("blurred");
  qs(".outOfFocusWarning")?.hide();
  Misc.clearTimeouts(outOfFocusTimeouts);
}

export function show(mode: "default" | "window" = "default"): void {
  if (!Config.showOutOfFocusWarning) return;
  outOfFocusTimeouts.push(
    setTimeout(() => {
      qsa("#words, #compositionDisplay")
        ?.setStyle({ transition: "0.25s" })
        ?.addClass("blurred");
      const touch = isTouchScreen();
      qs(".outOfFocusWarning .text")?.setText(
        (touch ? touchMessages : messages)[mode],
      );
      qs(".outOfFocusWarning i")
        ?.removeClass(["fa-mouse-pointer", "fa-hand-pointer"])
        .addClass(touch ? "fa-hand-pointer" : "fa-mouse-pointer");
      qs(".outOfFocusWarning")?.show();
    }, 1000),
  );
}
