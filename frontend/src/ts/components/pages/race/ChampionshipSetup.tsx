import { For, JSXElement, Show } from "solid-js";

import type { ReadingPassage, WordList } from "../../../classroom/assignments";

import { lessonGroups } from "../../../lessons/lessons-data";
import { CHAMP_ROUNDS } from "../../../race/championship";
import { cn } from "../../../utils/cn";
import { ContentDraft, ContentKind, RoundDraft } from "./champ-setup";

const selectClass =
  "w-full max-w-md rounded-xl bg-bg px-3 py-2 font-kid text-base text-text outline-none focus:outline-2 focus:outline-main";
const inputClass =
  "w-full rounded-xl bg-bg px-3 py-2 font-kid text-text outline-none focus:outline-2 focus:outline-main";

const KINDS: { value: ContentKind; label: string }[] = [
  { value: "random", label: "🎲 Random" },
  { value: "lesson", label: "📘 Lesson" },
  { value: "wordlist", label: "📝 Word list" },
  { value: "passage", label: "📖 Passage" },
  { value: "custom", label: "✏️ My text" },
];

function Pill(props: {
  active: boolean;
  label: string;
  onClick: () => void;
}): JSXElement {
  return (
    <button
      type="button"
      class={cn(
        "press-3d rounded-full px-3 py-1.5 font-kid text-sm font-bold",
        props.active ? "bg-main text-bg" : "bg-bg text-text hover:bg-sub/20",
      )}
      aria-pressed={props.active}
      onClick={() => props.onClick()}
    >
      {props.label}
    </button>
  );
}

/** "What to type" for one round. */
function ContentPicker(props: {
  value: ContentDraft;
  onChange: (c: ContentDraft) => void;
  wordLists: WordList[];
  passages: ReadingPassage[];
}): JSXElement {
  const set = (patch: Partial<ContentDraft>): void =>
    props.onChange({ ...props.value, ...patch });
  return (
    <div class="grid gap-2">
      <div class="flex flex-wrap gap-2">
        <For each={KINDS}>
          {(k) => (
            <Pill
              active={props.value.kind === k.value}
              label={k.label}
              onClick={() => set({ kind: k.value })}
            />
          )}
        </For>
      </div>
      <Show when={props.value.kind === "random"}>
        <div class="flex flex-wrap items-center gap-2 text-sm">
          <span class="text-sub">Words:</span>
          <For each={[10, 20, 30, 50]}>
            {(n) => (
              <Pill
                active={props.value.count === n}
                label={String(n)}
                onClick={() => set({ count: n })}
              />
            )}
          </For>
        </div>
      </Show>
      <Show when={props.value.kind !== "random"}>
        <div class="flex flex-wrap items-center gap-2 text-sm">
          <span class="text-sub">How many words?</span>
          <For each={[10, 20, 30, 0]}>
            {(n) => (
              <Pill
                active={props.value.limit === n}
                label={n === 0 ? "All" : String(n)}
                onClick={() => set({ limit: n })}
              />
            )}
          </For>
          <span class="text-xs text-sub">
            {props.value.kind === "passage"
              ? "A different part of the passage each round"
              : "Mixed up, different words each round"}
          </span>
        </div>
      </Show>
      <Show when={props.value.kind === "lesson"}>
        <select
          class={selectClass}
          value={props.value.lessonId}
          onChange={(e) => set({ lessonId: e.currentTarget.value })}
        >
          <For each={lessonGroups}>
            {(group) => (
              <optgroup label={group.name}>
                <For each={group.lessons}>
                  {(l) => <option value={l.id}>{l.name}</option>}
                </For>
              </optgroup>
            )}
          </For>
        </select>
      </Show>
      <Show when={props.value.kind === "wordlist"}>
        <select
          class={selectClass}
          value={props.value.wordListId}
          onChange={(e) => set({ wordListId: e.currentTarget.value })}
        >
          <option value="">Choose a word list…</option>
          <For each={props.wordLists}>
            {(wl) => <option value={wl.id}>{wl.title}</option>}
          </For>
        </select>
      </Show>
      <Show when={props.value.kind === "passage"}>
        <select
          class={selectClass}
          value={props.value.passageId}
          onChange={(e) => set({ passageId: e.currentTarget.value })}
        >
          <option value="">Choose a passage…</option>
          <For each={props.passages}>
            {(p) => <option value={p.id}>{p.title}</option>}
          </For>
        </select>
      </Show>
      <Show when={props.value.kind === "custom"}>
        <textarea
          class={cn(inputClass, "min-h-20 resize-y")}
          placeholder="Paste the words or text for this round…"
          value={props.value.custom}
          onInput={(e) => set({ custom: e.currentTarget.value })}
        ></textarea>
      </Show>
    </div>
  );
}

/** Championship setup: rounds on/off, words per round (or one for all). */
export function ChampionshipSetup(props: {
  rounds: RoundDraft[];
  onRounds: (r: RoundDraft[]) => void;
  sameWords: boolean;
  onSameWords: (v: boolean) => void;
  wordLists: WordList[];
  passages: ReadingPassage[];
}): JSXElement {
  const update = (i: number, patch: Partial<RoundDraft>): void =>
    props.onRounds(
      props.rounds.map((r, j) => (j === i ? { ...r, ...patch } : r)),
    );
  const enabledCount = (): number =>
    props.rounds.filter((r) => r.enabled).length;
  return (
    <div class="grid gap-4 font-kid">
      <div class="rounded-xl bg-bg p-3 text-sm text-sub">
        Points each round: 🥇 10 · 🥈 8 · 🥉 6 · 4th 5 · 5th 4 · 6th 3 · 7th 2 ·
        everyone else who plays 1. Most points after the last round is the 👑
        Class Champion. Prizes: 50 / 30 / 20 coins for the top 3, 5 for everyone
        who plays, and the champion unlocks the Champion Crown and title.
      </div>
      <div class="flex flex-wrap items-center gap-2 text-base text-text">
        Words:
        <Pill
          active={!props.sameWords}
          label="Different words each round"
          onClick={() => props.onSameWords(false)}
        />
        <Pill
          active={props.sameWords}
          label="Same words for every round"
          onClick={() => props.onSameWords(true)}
        />
      </div>
      <For each={props.rounds}>
        {(round, i) => {
          const info = CHAMP_ROUNDS[round.kind];
          return (
            <div
              class={cn(
                "grid gap-3 rounded-xl p-4",
                round.enabled ? "bg-bg/60" : "bg-bg/20 opacity-60",
              )}
            >
              <div class="flex flex-wrap items-center gap-3">
                <span class="text-lg font-bold text-text">
                  {info.emoji} {info.title}
                </span>
                <button
                  type="button"
                  class={cn(
                    "rounded-full px-3 py-1 text-sm font-bold",
                    round.enabled
                      ? "bg-game-green text-game-cream"
                      : "bg-bg text-sub",
                    round.enabled && enabledCount() <= 2
                      ? "cursor-not-allowed opacity-70"
                      : "cursor-pointer",
                  )}
                  aria-pressed={round.enabled}
                  title={
                    round.enabled && enabledCount() <= 2
                      ? "A championship needs at least 2 rounds"
                      : undefined
                  }
                  onClick={() => {
                    if (round.enabled && enabledCount() <= 2) return;
                    update(i(), { enabled: !round.enabled });
                  }}
                >
                  {round.enabled ? "✓ In" : "Off"}
                </button>
                <span class="text-sm text-sub">{info.blurb}</span>
              </div>
              <Show when={round.enabled}>
                <Show when={round.kind === "speed"}>
                  <div class="flex flex-wrap items-center gap-2 text-sm">
                    <span class="text-sub">How long?</span>
                    <For each={[30, 60]}>
                      {(sec) => (
                        <Pill
                          active={round.durationSec === sec}
                          label={`${sec} seconds`}
                          onClick={() => update(i(), { durationSec: sec })}
                        />
                      )}
                    </For>
                  </div>
                </Show>
                <Show
                  when={!props.sameWords || i() === 0}
                  fallback={
                    <div class="text-sm text-sub">
                      Uses the same words as the first round.
                    </div>
                  }
                >
                  <ContentPicker
                    value={round.content}
                    onChange={(c) => update(i(), { content: c })}
                    wordLists={props.wordLists}
                    passages={props.passages}
                  />
                </Show>
              </Show>
            </div>
          );
        }}
      </For>
    </div>
  );
}
