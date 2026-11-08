import {
  createEffect,
  createSignal,
  JSXElement,
  on,
  onCleanup,
  Show,
} from "solid-js";

import { GameModalFrame } from "../../../games/components/GameModalFrame";
import {
  GameResultOverlay,
  GameResultView,
} from "../../../games/components/GameResultOverlay";
import { sfx } from "../../../games/mini/mini-sounds";
import { MiniTypingInput } from "../../../games/mini/MiniTypingInput";
import {
  kanaAccuracy,
  KanaRunState,
  kanaWpm,
  newKanaRun,
  typeKey,
} from "../../../lessons/kana-romaji";
import {
  recordGameScore,
  recordKanaLessonResult,
} from "../../../lessons/lesson-progress";
import { contestWords } from "../../../lessons/lessons-data-jp";
import {
  closeKanaPractice,
  kanaPractice,
  KanaPractice,
} from "../../../states/kana-practice";
import { showErrorNotification } from "../../../states/notifications";
import { cn } from "../../../utils/cn";
import { KanaBoard } from "./KanaBoard";

/** The Maipaso romaji round: 60 seconds; their target score is 160. */
export const CONTEST_SECONDS = 60;
export const CONTEST_TARGET = 160;
export const CONTEST_SCORE_ID = "maipaso-romaji";
const HINTS_KEY = "gfaKanaHints";

function contestStars(score: number): number {
  if (score >= CONTEST_TARGET) return 3;
  if (score >= CONTEST_TARGET * 0.6) return 2;
  return score > 0 ? 1 : 0;
}

/**
 * Hiragana on screen, romaji from the keyboard. Runs a Japanese lesson
 * (type every word, then it's saved like any lesson) or the 60-second
 * Maipaso-style practice (score = kana typed correctly). The timer starts
 * at the first key.
 */
export function KanaPracticeModal(): JSXElement {
  const [run, setRun] = createSignal<KanaRunState | null>(null);
  const [startedAt, setStartedAt] = createSignal<number | null>(null);
  const [now, setNow] = createSignal(Date.now());
  const [result, setResult] = createSignal<GameResultView | null>(null);
  const [note, setNote] = createSignal<string>();
  const [hints, setHints] = createSignal(
    localStorage.getItem(HINTS_KEY) !== "off",
  );
  let input: HTMLInputElement | undefined;

  const practice = (): KanaPractice | null => kanaPractice();
  const isContest = (): boolean => practice()?.mode === "contest";
  const title = (): string => {
    const p = practice();
    if (p === null) return "";
    return p.mode === "contest"
      ? "Maipaso practice - Romaji (60 seconds)"
      : p.lesson.name;
  };
  const elapsed = (): number => {
    const t = startedAt();
    return t === null ? 0 : Math.max(0, (now() - t) / 1000);
  };
  const timeLeft = (): number => Math.max(0, CONTEST_SECONDS - elapsed());

  const start = async (): Promise<void> => {
    const p = practice();
    if (p === null) return;
    setResult(null);
    setNote(undefined);
    setStartedAt(null);
    setRun(null);
    try {
      const words =
        p.mode === "contest" ? await contestWords() : await p.lesson.generate();
      setRun(newKanaRun(words, { requireSpace: true }));
    } catch (error) {
      showErrorNotification("Could not load the words", { error });
      closeKanaPractice();
    }
  };

  createEffect(
    on(practice, (p) => {
      if (p !== null) {
        void start();
      } else {
        setRun(null);
        setResult(null);
      }
    }),
  );

  // clock
  createEffect(() => {
    if (startedAt() === null || result() !== null) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    onCleanup(() => clearInterval(t));
  });

  const finish = async (final: KanaRunState): Promise<void> => {
    const p = practice();
    if (p === null || result() !== null) return;
    const seconds = isContest() ? CONTEST_SECONDS : elapsed();
    const wpm = kanaWpm(final, seconds);
    const acc = kanaAccuracy(final);
    const stats = [
      { label: "正解数 correct", value: String(final.correctKana) },
      { label: "不正解数 mistakes", value: String(final.wrongKana) },
      { label: "accuracy", value: `${Math.round(acc)}%` },
    ];
    if (p.mode === "contest") {
      const score = final.correctKana;
      sfx.finish();
      setResult({
        headline:
          score >= CONTEST_TARGET ? "Contest goal reached! 🏆" : "Time's up!",
        score,
        scoreLabel: "kana typed",
        stars: contestStars(score),
        stats: [
          ...stats,
          { label: "contest goal", value: `${CONTEST_TARGET}` },
        ],
      });
      void recordGameScore(CONTEST_SCORE_ID, score);
      return;
    }
    sfx.finish();
    setResult({
      headline: "Lesson done! 🎉",
      score: final.correctKana,
      scoreLabel: "kana typed",
      stats: [...stats, { label: "speed", value: `${Math.round(wpm)} wpm` }],
    });
    setNote("Saving…");
    const saved = await recordKanaLessonResult(p.lesson.id, {
      wpm,
      acc,
      seconds,
    });
    if (saved?.ok === true) {
      setResult((r) => (r === null ? r : { ...r, stars: saved.stars ?? 1 }));
      setNote(
        (saved.coinsAwarded ?? 0) > 0
          ? `🪙 +${saved.coinsAwarded} coins!`
          : "Saved to your lessons.",
      );
    } else {
      setNote("Sign in to save your lessons.");
    }
  };

  // the 60 seconds ran out
  createEffect(() => {
    const r = run();
    if (!isContest() || r === null || startedAt() === null) return;
    if (timeLeft() <= 0 && result() === null) void finish(r);
  });

  const onKeys = (value: string): void => {
    let r = run();
    if (r === null || result() !== null || value === "") return;
    if (startedAt() === null) {
      setStartedAt(Date.now());
      setNow(Date.now());
    }
    const before = r.wrongKana;
    for (const ch of value) r = typeKey(r, ch);
    if (input !== undefined) input.value = "";
    if (r.wrongKana > before) sfx.oops();
    setRun(r);
    if (r.finished) void finish(r);
  };

  const toggleHints = (): void => {
    const next = !hints();
    setHints(next);
    localStorage.setItem(HINTS_KEY, next ? "on" : "off");
    input?.focus();
  };

  return (
    <Show when={practice()}>
      <GameModalFrame
        layout="playing"
        needsKeyboard={false}
        onClose={closeKanaPractice}
      >
        <div class="relative flex h-full flex-col gap-3 bg-linear-to-b from-game-sky-top to-game-sky p-3 pt-16 font-kid sm:p-5 sm:pt-16">
          {/* header */}
          <div class="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-game-cream/90 px-4 py-2 text-game-ink">
            <div class="text-lg font-bold">{title()}</div>
            <div class="flex items-center gap-3">
              <Show when={!isContest()}>
                <button
                  type="button"
                  class={cn(
                    "cursor-pointer rounded-full px-3 py-1 text-sm font-semibold",
                    hints()
                      ? "bg-game-blue text-game-cream"
                      : "bg-game-ink/10 text-game-ink/70",
                  )}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={toggleHints}
                >
                  {hints() ? "Romaji hints: on" : "Romaji hints: off"}
                </button>
              </Show>
              <div class="min-w-20 rounded-lg bg-game-ink px-3 py-1 text-center font-mono text-xl font-bold text-game-cream tabular-nums">
                {isContest()
                  ? `${Math.ceil(timeLeft())}s`
                  : `${Math.floor(elapsed())}s`}
              </div>
            </div>
          </div>

          <Show
            when={run()}
            fallback={
              <div class="flex flex-1 items-center justify-center text-game-ink/60">
                Loading…
              </div>
            }
          >
            {(r) => <KanaBoard run={r()} showHints={hints() && !isContest()} />}
          </Show>

          {/* counters */}
          <div class="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 rounded-xl bg-game-cream/90 px-4 py-2 text-game-ink">
            <span>
              正解数{" "}
              <b class="text-xl tabular-nums">{run()?.correctKana ?? 0}</b>
            </span>
            <span>
              不正解数{" "}
              <b class="text-xl text-game-red tabular-nums">
                {run()?.wrongKana ?? 0}
              </b>
            </span>
            <Show
              when={isContest()}
              fallback={
                <span class="text-sm text-game-ink/60">
                  word{" "}
                  {Math.min(
                    (run()?.wordIndex ?? 0) + 1,
                    run()?.words.length ?? 0,
                  )}{" "}
                  of {run()?.words.length ?? 0}
                </span>
              }
            >
              <span class="text-sm text-game-ink/60">
                goal {CONTEST_TARGET} in {CONTEST_SECONDS}s
              </span>
            </Show>
          </div>

          <div class="flex min-h-16 items-center justify-center">
            <MiniTypingInput
              value=""
              ref={(el) => (input = el)}
              onInput={onKeys}
              waiting={result() !== null}
              placeholder={
                startedAt() === null
                  ? "type the romaji to start"
                  : run()?.awaitingSpace === true
                    ? "press space ␣"
                    : "type the romaji"
              }
            />
          </div>

          <Show when={result()}>
            {(res) => (
              <GameResultOverlay
                result={res()}
                note={note()}
                onPlayAgain={() => void start()}
                onExit={closeKanaPractice}
              />
            )}
          </Show>
        </div>
      </GameModalFrame>
    </Show>
  );
}
