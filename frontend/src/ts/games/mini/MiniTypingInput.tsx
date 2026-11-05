import { createSignal, JSXElement, onCleanup, onMount, Show } from "solid-js";

import { Fa } from "../../components/common/Fa";
import { cn } from "../../utils/cn";

/**
 * Big, kid-friendly typing box. Plain <input> so the iPad on-screen
 * keyboard appears; autocorrect/caps are off so words stay exact.
 *
 * Keep it mounted for the whole game: iPad Safari only focuses an input (and
 * opens its keyboard) from a tap, so an input that is removed and re-added
 * between turns comes back unfocused. Use `waiting` for "not your turn yet"
 * instead - typing is ignored but focus and the keyboard stay put.
 */
export function MiniTypingInput(props: {
  value: string;
  onInput: (value: string) => void;
  onEnter?: () => void;
  wrong?: boolean;
  placeholder?: string;
  /** not your turn yet: keep focus, ignore typing */
  waiting?: boolean;
  ref?: (el: HTMLInputElement) => void;
}): JSXElement {
  let el: HTMLInputElement | undefined;
  let refocusTimer: ReturnType<typeof setTimeout> | undefined;
  const [focused, setFocused] = createSignal(true);

  const focusInput = (): void => {
    el?.focus({ preventScroll: true });
  };

  onMount(() => {
    focusInput();
    setFocused(document.activeElement === el);
  });
  onCleanup(() => clearTimeout(refocusTimer));

  return (
    <div class="relative flex w-full max-w-md flex-col items-center">
      <Show when={!focused() && props.waiting !== true}>
        <button
          type="button"
          class="absolute bottom-full mb-2 flex animate-bounce cursor-pointer items-center gap-2 rounded-full bg-game-yellow px-5 py-2 text-lg font-bold text-game-ink shadow-[0_4px_0_rgb(0_0_0/0.25)] motion-reduce:animate-none"
          // focus inside the tap itself, so iPad opens the keyboard
          onPointerDown={(e) => {
            e.preventDefault();
            focusInput();
          }}
          onClick={focusInput}
        >
          <Fa icon="fa-hand-pointer" />
          Tap here to type!
        </button>
      </Show>
      <input
        ref={(e) => {
          el = e;
          props.ref?.(e);
        }}
        type="text"
        value={props.value}
        placeholder={props.placeholder ?? "type here"}
        aria-label="Type here"
        autocomplete="off"
        autocapitalize="off"
        // oxlint-disable-next-line react/no-unknown-property
        autocorrect="off"
        spellcheck={false}
        class={cn(
          "pointer-events-auto w-full rounded-double border-4 bg-game-cream px-5 py-3 text-center font-mono text-2xl font-bold text-game-ink shadow-[0_6px_0_rgb(43_33_64/0.25)] outline-none placeholder:text-game-ink/35",
          props.waiting === true && "opacity-60",
          props.wrong === true
            ? "animate-game-shake border-game-red motion-reduce:animate-none"
            : !focused() && props.waiting !== true
              ? "animate-pulse border-game-yellow motion-reduce:animate-none"
              : "border-game-ink/15 focus:border-game-blue",
        )}
        onFocus={() => {
          clearTimeout(refocusTimer);
          setFocused(true);
        }}
        onBlur={() => {
          setFocused(false);
          // Lost focus to nothing (tapped the table, a re-render...): take it
          // back. Leave it alone when another control (a button) took it.
          clearTimeout(refocusTimer);
          refocusTimer = setTimeout(() => {
            const active = document.activeElement;
            if (
              el?.isConnected === true &&
              (active === null || active === document.body)
            ) {
              focusInput();
            }
          }, 0);
        }}
        onInput={(e) => {
          if (props.waiting === true) {
            e.currentTarget.value = "";
            return;
          }
          props.onInput(e.currentTarget.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            props.onEnter?.();
          }
        }}
      />
    </div>
  );
}
