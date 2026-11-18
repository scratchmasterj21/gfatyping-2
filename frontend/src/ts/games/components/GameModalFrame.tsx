import { createSignal, JSXElement, Show } from "solid-js";

import { Fa } from "../../components/common/Fa";
import { cn } from "../../utils/cn";
import { MuteButton } from "./MuteButton";

const isTouchScreen =
  typeof window.matchMedia === "function" &&
  window.matchMedia("(pointer: coarse)").matches;

// Session-wide: once a physical key is seen, the hint never shows again.
const [hardwareKeySeen, setHardwareKeySeen] = createSignal(!isTouchScreen);
if (isTouchScreen) {
  window.addEventListener("keydown", () => setHardwareKeySeen(true), {
    capture: true,
    once: true,
  });
}

export function GameModalFrame(props: {
  layout: "pick" | "playing" | "compact";
  onClose: () => void;
  showBackButton?: boolean;
  needsKeyboard?: boolean;
  children: JSXElement;
}): JSXElement {
  const showBack = (): boolean => props.showBackButton !== false;
  const showKeyboardHint = (): boolean =>
    props.layout === "playing" &&
    props.needsKeyboard !== false &&
    !hardwareKeySeen();
  return (
    <div class="fixed inset-0 z-[150] flex items-center justify-center bg-bg/95">
      <div
        class={cn(
          "relative flex flex-col overflow-hidden rounded-double border-2 border-main/40 bg-bg shadow-2xl",
          props.layout === "playing"
            ? "h-[90vh] w-[95vw] max-w-5xl supports-[height:100dvh]:h-[90dvh]"
            : props.layout === "pick"
              ? "max-h-[94vh] w-full max-w-lg supports-[height:100dvh]:max-h-[94dvh]"
              : "w-full max-w-lg p-5",
        )}
      >
        <Show when={showBack() && props.layout === "playing"}>
          <button
            type="button"
            class="absolute top-3 right-3 z-10 flex min-h-11 items-center justify-center rounded-full bg-sub-alt px-4 text-sm font-semibold text-text hover:bg-text hover:text-bg"
            onClick={() => props.onClose()}
          >
            ← Back to lessons
          </button>
        </Show>
        <Show when={props.layout === "playing"}>
          <MuteButton class="absolute top-3 left-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-sub-alt text-text hover:bg-text hover:text-bg" />
        </Show>
        {props.children}
        <Show when={showKeyboardHint()}>
          <div class="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-4">
            <div class="flex max-w-sm flex-col items-center gap-2 rounded-double border-2 border-main/40 bg-bg/95 p-5 text-center shadow-2xl">
              <Fa icon="fa-keyboard" class="text-3xl text-main" />
              <div class="text-lg font-bold text-text">
                Connect a keyboard to play
              </div>
              <div class="text-sm text-sub">
                This game needs a real keyboard. Press any key to start.
              </div>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
