import { createEffect, createSignal, JSXElement, on } from "solid-js";

import { kanaPrefixMatch } from "../../lessons/kana-romaji";
import { sfx } from "../mini/mini-sounds";
import { MiniTypingInput } from "../mini/MiniTypingInput";

/**
 * Typing box for the romaji games: several hiragana words are on screen and
 * the student types the romaji of any one of them. Finishing a word calls
 * onDone; a key that fits no word is a miss and clears the box.
 */
export function KanaPickInput(props: {
  candidates: string[];
  onDone: (word: string) => void;
  onMiss?: () => void;
  /** what's typed so far, for highlighting words on screen */
  onTyped?: (typed: string) => void;
  waiting?: boolean;
  placeholder?: string;
}): JSXElement {
  const [typed, setTyped] = createSignal("");
  const [wrong, setWrong] = createSignal(false);
  let input: HTMLInputElement | undefined;

  const setT = (t: string): void => {
    setTyped(t);
    props.onTyped?.(t);
  };

  // words changed (taken by someone, new round): drop typing that no longer fits
  createEffect(
    on(
      () => props.candidates.join("|"),
      () => {
        const t = typed();
        if (t === "") return;
        if (!props.candidates.some((w) => kanaPrefixMatch(w, t).ok)) setT("");
      },
    ),
  );
  createEffect(
    on(
      () => props.waiting,
      (w) => {
        if (w === true) setT("");
      },
    ),
  );

  const onKey = (ch: string): void => {
    const key = ch.toLowerCase();
    if (key === " ") return;
    const t = typed() + key;
    const matches = props.candidates.filter((w) => kanaPrefixMatch(w, t).ok);
    if (matches.length === 0) {
      setWrong(true);
      sfx.oops();
      setT("");
      props.onMiss?.();
      return;
    }
    setWrong(false);
    const done = matches.find((w) => kanaPrefixMatch(w, t).done);
    if (done !== undefined) {
      setT("");
      props.onDone(done);
      return;
    }
    setT(t);
  };

  return (
    <div class="flex w-full flex-col items-center gap-1">
      <div class="h-6 font-mono text-lg font-bold text-game-cream">
        {typed()}
      </div>
      <MiniTypingInput
        value=""
        ref={(el) => (input = el)}
        onInput={(value) => {
          if (props.waiting === true) return;
          for (const ch of value) onKey(ch);
          if (input !== undefined) input.value = "";
        }}
        wrong={wrong()}
        waiting={props.waiting}
        placeholder={props.placeholder ?? "type the romaji"}
      />
    </div>
  );
}
