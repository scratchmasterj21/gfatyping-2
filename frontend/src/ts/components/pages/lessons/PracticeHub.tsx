import { useQuery } from "@tanstack/solid-query";
import { createSignal, For, JSXElement, onMount, Show } from "solid-js";

import { Grade, gradeOf, GRADES } from "../../../constants/classes";
import { getAuthenticatedUser } from "../../../firebase";
import { myToday } from "../../../games/game-access";
import { myTypedWords } from "../../../practice/practice-reward";
import {
  badgesFor,
  bestWpm,
  CLASS_GOALS,
  DAILY_GOAL_MIN,
  gardenSize,
  getClassGoals,
  getImprovedBoard,
  loadStoryProgress,
  plantFor,
  racingBest,
  setRaceBest,
  SPEED_BADGES,
  startStoryChapter,
  storyProgress,
  weekId,
  WORDS_PER_PLANT,
} from "../../../practice/practice-state";
import { BAND_NAME, bandFor, storiesFor } from "../../../practice/stories";
import { getSnapshot } from "../../../states/snapshot";
import { cn } from "../../../utils/cn";

const FIVE_MIN = 5 * 60 * 1000;

/** Print a simple speed-badge certificate in a new window. */
function printBadge(name: string, wpm: number): void {
  const date = new Date().toLocaleDateString("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const html = `<!doctype html><html><head><title>Speed badge</title>
<style>@page{size:A4 landscape;margin:0}body{margin:0;font-family:system-ui,sans-serif;display:grid;place-items:center;height:100vh;background:#fff8ec}
.c{border:14px solid #ffc61a;border-radius:28px;padding:48px 72px;text-align:center;background:white}
h1{font-size:46px;margin:0;color:#2b2140}.b{font-size:120px}.n{font-size:40px;margin:12px 0;color:#5aa9ff}p{font-size:22px;color:#2b2140}</style>
</head><body><div class="c"><div class="b">⚡</div><h1>Speed Badge: ${wpm} WPM</h1>
<div class="n">${name.replace(/[<>&]/g, "")}</div><p>typed ${wpm} words per minute in GFA Typing</p><p>${date}</p></div>
<script>window.onload=()=>window.print()</script></body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  window.open(url, "_blank", "width=900,height=640");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Free typing on the Practice tab: today's typing ring, story chapters,
 * race-your-best, the word garden, speed badges and the class boards.
 */
export function PracticeHub(): JSXElement {
  const [race, setRace] = createSignal(racingBest());
  onMount(loadStoryProgress);
  const signedIn = (): boolean => getAuthenticatedUser() !== null;
  const grade = (): Grade | undefined =>
    GRADES.find((g) => g === gradeOf(getSnapshot()?.classId));
  const classId = (): string | undefined => getSnapshot()?.classId ?? undefined;
  const week = weekId();

  const goals = useQuery(() => ({
    queryKey: ["classGoals", week],
    queryFn: async () => getClassGoals(week),
    staleTime: FIVE_MIN,
    enabled: signedIn() && classId() !== undefined,
  }));
  const improved = useQuery(() => ({
    queryKey: ["improvedBoard", grade(), week],
    queryFn: async () => getImprovedBoard(grade() ?? "G1", week),
    staleTime: FIVE_MIN,
    enabled: signedIn() && grade() !== undefined,
  }));

  const typedMin = (): number => Math.floor(myToday().typingSec / 60);
  const ring = (): number => Math.min(1, typedMin() / DAILY_GOAL_MIN);
  const words = (): number => myTypedWords();
  const plants = (): number => gardenSize(words());
  const best = (): number => bestWpm();
  const classWords = (): number => goals.data?.[classId() ?? ""] ?? 0;
  const nextGoal = (): (typeof CLASS_GOALS)[number] =>
    CLASS_GOALS.find((g) => classWords() < g.words) ??
    (CLASS_GOALS[CLASS_GOALS.length - 1] as (typeof CLASS_GOALS)[number]);
  const medals = (): string =>
    CLASS_GOALS.filter((g) => classWords() >= g.words)
      .map((g) => g.medal)
      .join("");

  return (
    <section class="grid gap-4 font-kid">
      {/* today */}
      <div class="flex flex-wrap items-center gap-4 rounded-double bg-sub-alt p-4">
        <svg viewBox="0 0 64 64" class="h-20 w-20 shrink-0 -rotate-90">
          <circle
            cx="32"
            cy="32"
            r="26"
            fill="none"
            stroke="var(--color-game-ink)"
            stroke-opacity="0.15"
            stroke-width="10"
          ></circle>
          <circle
            cx="32"
            cy="32"
            r="26"
            fill="none"
            stroke="var(--color-game-green)"
            stroke-width="10"
            stroke-linecap="round"
            pathLength="100"
            // oxlint-disable-next-line react/no-unknown-property
            stroke-dasharray={`${ring() * 100} 100`}
          ></circle>
        </svg>
        <div class="grid min-w-0 flex-1 gap-1">
          <div class="text-xl font-bold text-text">
            {ring() >= 1
              ? "🎉 Today's typing goal done!"
              : `⌨️ Type ${DAILY_GOAL_MIN} minutes today`}
          </div>
          <div class="text-sub">
            {Math.min(typedMin(), DAILY_GOAL_MIN)} / {DAILY_GOAL_MIN} min · 🔥{" "}
            {getSnapshot()?.streak ?? 0}-day streak · first 3 tests each day pay
            double coins!
          </div>
        </div>
        <label class="flex cursor-pointer items-center gap-2 rounded-full bg-bg px-3 py-2 text-sm font-bold text-text">
          <input
            type="checkbox"
            checked={race()}
            onChange={(e) => {
              setRace(e.currentTarget.checked);
              setRaceBest(e.currentTarget.checked);
            }}
          />
          👻 Race your best
        </label>
      </div>

      {/* stories */}
      <div class="grid gap-2">
        <div class="text-lg font-bold text-text">
          📖 Story mode · {BAND_NAME[bandFor(grade())]}
        </div>
        <div class="grid gap-2 sm:grid-cols-2">
          <For each={storiesFor(bandFor(grade()))}>
            {(story) => {
              const done = (): number => storyProgress()[story.id] ?? 0;
              const next = (): number =>
                Math.min(done(), story.chapters.length - 1);
              return (
                <div class="grid gap-2 rounded-double bg-sub-alt p-3">
                  <div class="flex items-center gap-2">
                    <span class="text-3xl">{story.emoji}</span>
                    <div class="min-w-0 flex-1">
                      <div class="font-bold text-text">{story.title}</div>
                      <div class="text-sm text-sub">
                        {done() >= story.chapters.length
                          ? "✅ The end! Read it again any time."
                          : `Chapter ${done() + 1}: ${story.chapters[done()]?.title ?? ""}`}
                      </div>
                    </div>
                  </div>
                  <div class="flex gap-1">
                    <For each={story.chapters}>
                      {(ch, i) => (
                        <button
                          type="button"
                          disabled={i() > done()}
                          title={ch.title}
                          class={cn(
                            "h-9 flex-1 rounded-lg text-sm font-bold",
                            i() < done()
                              ? "cursor-pointer bg-main text-bg"
                              : i() === done()
                                ? "cursor-pointer bg-game-yellow text-game-ink"
                                : "cursor-not-allowed bg-bg text-sub opacity-60",
                          )}
                          onClick={() => startStoryChapter(story.id, i())}
                        >
                          {i() < done() ? "✓" : i() > done() ? "🔒" : i() + 1}
                        </button>
                      )}
                    </For>
                  </div>
                  <button
                    type="button"
                    class="cursor-pointer rounded-full bg-main px-4 py-2 font-bold text-bg"
                    onClick={() => startStoryChapter(story.id, next())}
                  >
                    {done() >= story.chapters.length
                      ? "Read chapter 1 again"
                      : `Type chapter ${next() + 1}`}
                  </button>
                </div>
              );
            }}
          </For>
        </div>
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        {/* garden */}
        <div class="grid gap-2 rounded-double bg-sub-alt p-4">
          <div class="text-lg font-bold text-text">🌱 My word garden</div>
          <div class="text-sm text-sub">
            Every {WORDS_PER_PLANT} correct words grows a plant. {words()} words
            so far!
          </div>
          <div class="flex min-h-12 flex-wrap gap-1 rounded-xl border-b-8 border-game-brown bg-game-grass/30 p-2 text-2xl">
            <Show
              when={plants() > 0}
              fallback={
                <span class="text-sm text-sub">
                  Type in Practice to plant your first seed!
                </span>
              }
            >
              <For each={Array.from({ length: Math.min(plants(), 80) })}>
                {(_, i) => <span>{plantFor(i())}</span>}
              </For>
            </Show>
          </div>
          <div class="flex items-center gap-2 text-sm text-sub">
            Next {plantFor(plants())}
            <div class="h-2.5 flex-1 overflow-hidden rounded-full bg-bg">
              <div
                class="h-full rounded-full bg-game-green"
                style={{ width: `${words() % WORDS_PER_PLANT}%` }}
              ></div>
            </div>
            {words() % WORDS_PER_PLANT}/{WORDS_PER_PLANT}
          </div>
        </div>

        {/* speed badges */}
        <div class="grid gap-2 rounded-double bg-sub-alt p-4">
          <div class="text-lg font-bold text-text">⚡ Speed badges</div>
          <div class="text-sm text-sub">
            Your best: {best()} words per minute
          </div>
          <div class="flex flex-wrap gap-2">
            <For each={SPEED_BADGES}>
              {(b) => {
                const have = (): boolean => badgesFor(best()).includes(b);
                return (
                  <button
                    type="button"
                    disabled={!have()}
                    title={have() ? "Print this badge" : `Reach ${b} WPM`}
                    class={cn(
                      "grid h-14 w-14 place-items-center rounded-full border-4 text-sm font-bold",
                      have()
                        ? "cursor-pointer border-game-gold bg-game-yellow text-game-ink"
                        : "border-sub/30 bg-bg text-sub opacity-60",
                    )}
                    onClick={() =>
                      printBadge(getSnapshot()?.name ?? "Student", b)
                    }
                  >
                    {b}
                  </button>
                );
              }}
            </For>
          </div>
          <div class="text-xs text-sub">Tap a badge you have to print it.</div>
        </div>

        {/* class goal */}
        <Show when={signedIn() && classId() !== undefined}>
          <div class="grid gap-2 rounded-double bg-sub-alt p-4">
            <div class="text-lg font-bold text-text">
              🏫 {classId()} class goal this week {medals()}
            </div>
            <div class="text-sm text-sub">
              Together you typed {classWords().toLocaleString()} words. Next
              medal {nextGoal().medal} at {nextGoal().words.toLocaleString()}!
            </div>
            <div class="h-4 overflow-hidden rounded-full bg-bg">
              <div
                class="h-full rounded-full bg-main transition-[width]"
                style={{
                  width: `${Math.min(100, (classWords() / nextGoal().words) * 100)}%`,
                }}
              ></div>
            </div>
          </div>
        </Show>

        {/* most improved */}
        <Show when={signedIn() && grade() !== undefined}>
          <div class="grid gap-2 rounded-double bg-sub-alt p-4">
            <div class="text-lg font-bold text-text">
              🌟 Most improved in {grade()} this week
            </div>
            <div class="text-sm text-sub">
              Beat your best speed from last week to get on the board!
            </div>
            <Show
              when={(improved.data ?? []).length > 0}
              fallback={
                <div class="text-sm text-sub">
                  {improved.isLoading
                    ? "Loading…"
                    : "Nobody yet - it could be you!"}
                </div>
              }
            >
              <For each={(improved.data ?? []).slice(0, 5)}>
                {(r, i) => (
                  <div
                    class={cn(
                      "flex items-center gap-2 rounded-lg px-2 py-1 text-sm",
                      r.uid === getAuthenticatedUser()?.uid
                        ? "bg-main text-bg"
                        : "bg-bg",
                    )}
                  >
                    <span class="w-6 font-bold">
                      {["🥇", "🥈", "🥉"][i()] ?? `${i() + 1}.`}
                    </span>
                    <span class="flex-1 truncate">
                      {r.name} <span class="opacity-70">{r.classId}</span>
                    </span>
                    <span class="font-bold">+{r.gain} WPM</span>
                  </div>
                )}
              </For>
            </Show>
          </div>
        </Show>
      </div>
    </section>
  );
}
