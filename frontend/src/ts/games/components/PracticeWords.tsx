import { For, JSXElement, Show } from "solid-js";

/** "Practice these words" chips for an end screen (from a typing report). */
export function PracticeWords(props: { words: string[] }): JSXElement {
  return (
    <Show when={props.words.length > 0}>
      <div class="grid w-full gap-1">
        <div class="text-sm font-bold text-sub">📝 Practice these words</div>
        <div class="flex flex-wrap justify-center gap-2">
          <For each={props.words}>
            {(w) => (
              <span class="rounded-lg bg-sub-alt px-3 py-1 font-mono text-lg font-bold text-text">
                {w}
              </span>
            )}
          </For>
        </div>
      </div>
    </Show>
  );
}
