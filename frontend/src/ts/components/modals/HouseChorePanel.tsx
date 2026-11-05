import { createSignal, For, JSXElement, Show } from "solid-js";

import { tokyoDate } from "../../classroom/activity";
import { MiniTypingInput } from "../../games/mini/MiniTypingInput";
import {
  choreForDate,
  claimHouseChore,
  HOUSE_CHORE_COINS,
} from "../../house/house-chores";
import {
  showErrorNotification,
  showNoticeNotification,
} from "../../states/notifications";
import { cn } from "../../utils/cn";
import { Fa } from "../common/Fa";

/**
 * Today's house chore: a button above the room, and a small typing panel -
 * type each word to finish it and earn a few coins (once a day).
 */
export function HouseChorePanel(props: {
  /** Japan date of the last finished chore (from the house state) */
  choreDate?: string;
  onDone: () => void;
}): JSXElement {
  const chore = choreForDate();
  const [open, setOpen] = createSignal(false);
  const [index, setIndex] = createSignal(0);
  const [typed, setTyped] = createSignal("");
  const [wrong, setWrong] = createSignal(false);
  const [doneLocal, setDoneLocal] = createSignal(false);
  const [saving, setSaving] = createSignal(false);

  const doneToday = (): boolean =>
    doneLocal() || props.choreDate === tokyoDate();
  const word = (): string => chore.words[index()] ?? "";

  const finish = async (): Promise<void> => {
    setSaving(true);
    try {
      const result = await claimHouseChore();
      setDoneLocal(true);
      showNoticeNotification(
        result.claimed
          ? `${chore.emoji} Chore done! +${result.coins} coins`
          : `${chore.emoji} Chore done! (coins already earned today)`,
        { durationMs: 3000 },
      );
      setOpen(false);
      props.onDone();
    } catch (error) {
      showErrorNotification("Could not save your chore", { error });
    } finally {
      setSaving(false);
    }
  };

  const onInput = (value: string): void => {
    const target = word();
    if (!target.startsWith(value.trim())) {
      setWrong(true);
      return;
    }
    setWrong(false);
    setTyped(value);
    if (value.trim() !== target) return;
    setTyped("");
    if (index() + 1 >= chore.words.length) {
      void finish();
    } else {
      setIndex((i) => i + 1);
    }
  };

  return (
    <>
      <button
        type="button"
        class={cn(
          "flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-4 font-kid text-base font-semibold",
          doneToday()
            ? "bg-sub-alt text-sub"
            : "bg-game-green text-game-cream hover:opacity-90",
        )}
        disabled={doneToday()}
        onClick={() => {
          setIndex(0);
          setTyped("");
          setOpen(true);
        }}
      >
        <span class="text-xl">{chore.emoji}</span>
        {doneToday()
          ? `"${chore.title}" done today - come back tomorrow!`
          : `Today's chore: ${chore.title} (+${HOUSE_CHORE_COINS} coins)`}
      </button>

      <Show when={open()}>
        <div class="fixed inset-0 z-[300] flex items-center justify-center bg-game-ink/50 p-4">
          <div class="grid w-full max-w-md gap-4 rounded-2xl bg-game-cream p-5 font-kid text-game-ink shadow-xl">
            <div class="flex items-center justify-between">
              <div class="text-xl font-bold">
                {chore.emoji} {chore.title}
              </div>
              <button
                type="button"
                class="cursor-pointer rounded-none bg-transparent p-0 text-game-ink/60 hover:bg-transparent hover:text-game-ink"
                aria-label="Close chore"
                onClick={() => setOpen(false)}
              >
                <Fa icon="fa-times" />
              </button>
            </div>
            <div class="text-sm text-game-ink/70">
              Type each word to finish the chore!
            </div>
            <div class="flex flex-wrap justify-center gap-2">
              <For each={chore.words}>
                {(w, i) => (
                  <span
                    class={cn(
                      "rounded-full px-3 py-1 font-mono text-lg font-bold",
                      i() < index()
                        ? "bg-game-green text-game-cream"
                        : i() === index()
                          ? "bg-game-yellow text-game-ink ring-2 ring-game-ink/30"
                          : "bg-game-ink/10 text-game-ink/60",
                    )}
                  >
                    {i() < index() ? "✓ " : ""}
                    {w}
                  </span>
                )}
              </For>
            </div>
            <div class="flex justify-center">
              <MiniTypingInput
                value={typed()}
                onInput={onInput}
                wrong={wrong()}
                waiting={saving()}
                placeholder={word()}
              />
            </div>
          </div>
        </div>
      </Show>
    </>
  );
}
