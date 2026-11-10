import {
  createEffect,
  createSignal,
  For,
  JSXElement,
  Match,
  Show,
  Switch,
  untrack,
} from "solid-js";

import { Button } from "../../components/common/Button";
import { Fa } from "../../components/common/Fa";
import { Mascot } from "../../components/common/Mascot";
import {
  DifficultyOption,
  DifficultySegmented,
} from "../components/DifficultySegmented";
import { GameModalFrame } from "../components/GameModalFrame";
import { GameModalHeader } from "../components/GameModalHeader";
import { GamePickLayout } from "../components/GamePickLayout";
import { GameSetupMore } from "../components/GameSetupMore";
import { GameSetupPrimaryAction } from "../components/GameSetupPrimaryAction";
import { GameSetupSection } from "../components/GameSetupSection";
import { groupWordListOptions } from "../components/groupWordListOptions";
import { ScoreRaceBoard } from "../components/score-race/ScoreRaceBoard";
import { ScoreRaceFooter } from "../components/score-race/ScoreRaceFooter";
import { ScoreRaceLobby } from "../components/score-race/ScoreRaceLobby";
import { ScoreRaceModeSection } from "../components/score-race/ScoreRaceModeSection";
import { ScoreRaceResults } from "../components/score-race/ScoreRaceResults";
import { useScoreRace } from "../components/score-race/use-score-race";
import { WordListPicker } from "../components/WordListPicker";
import { ScoreRaceGameId } from "../shared/score-race";
import {
  getWordListOptions,
  WordListOption,
} from "../word-defender/systems/vocab-pool";
import { CoinCountUp } from "./CoinCountUp";
import { Confetti } from "./Confetti";
import {
  claimMiniGameReward,
  MiniGameClaim,
  MiniGameId,
  MINI_GAME_MAX_COINS_PER_RUN,
  MINI_GAME_PAID_RUNS_PER_DAY,
} from "./mini-game-reward";
import { sfx } from "./mini-sounds";
import { StarRating } from "./StarRating";

const OPTIONS = getWordListOptions();
const GROUPS = groupWordListOptions(OPTIONS);

export type MiniGameResult = {
  score: number;
  /** Rounds/levels reached - used for the game-of-the-day bonus (min 1). */
  wave: number;
  stats: { label: string; value: string }[];
  headline: string;
  /** 0-3 stars for the result screen; omit to hide stars. */
  stars?: number;
};

export type MiniGamePlayProps<D> = {
  words: string[];
  difficulty: D;
  onFinish: (result: MiniGameResult) => void;
  /** live score, for the multiplayer scoreboard */
  onScore?: (score: number) => void;
};

/** Match lengths offered for games that don't time themselves. */
const RACE_LENGTHS = [60, 120, 180] as const;

/**
 * Shared setup -> play -> result flow for the DOM mini games. Each game only
 * renders its play area; this shell handles word lists, difficulty, the
 * result screen and the coin claim.
 */
export function MiniGameShell<D extends DifficultyOption>(props: {
  open: boolean;
  onClose: () => void;
  gameId: MiniGameId & ScoreRaceGameId;
  initialMode?: "solo" | "together";
  /** together: match length from the difficulty (games with their own
   * timer); omit to let the host pick a length */
  raceDurationSec?: (difficulty: D) => number;
  title: string;
  howToPlay: JSXElement;
  difficulties: D[];
  /** Echo Keys works from key sets, not word lists. */
  usesWordList?: boolean;
  play: (p: MiniGamePlayProps<D>) => JSXElement;
  onResult?: (score: number, wave: number) => void;
}): JSXElement {
  const [selected, setSelected] = createSignal<WordListOption>(
    OPTIONS[0] as WordListOption,
  );
  const [difficulty, setDifficulty] = createSignal<D>(
    untrack(() => props.difficulties[0] as D),
  );
  const [phase, setPhase] = createSignal<
    "pick" | "loading" | "playing" | "result"
  >("pick");
  const [words, setWords] = createSignal<string[]>([]);
  const [result, setResult] = createSignal<MiniGameResult | null>(null);
  const [claim, setClaim] = createSignal<MiniGameClaim | "pending">("pending");
  // bumps on every start so the play area remounts fresh
  const [runId, setRunId] = createSignal(0);
  const [mode, setMode] = createSignal<"solo" | "together">("solo");
  const [raceLength, setRaceLength] = createSignal<number>(RACE_LENGTHS[0]);
  /** my game is over in a match, the others are still playing */
  const [raceDone, setRaceDone] = createSignal<number | null>(null);
  let raceScore = 0;
  let raceRewarded = false;

  const rewardRace = (score: number, wave: number): void => {
    if (raceRewarded) return;
    raceRewarded = true;
    props.onResult?.(score, Math.max(1, wave));
    void claimMiniGameReward(props.gameId, score);
  };

  const race = useScoreRace({
    gameId: untrack(() => props.gameId),
    title: untrack(() => props.title),
    onStart: (room) => {
      setDifficulty(
        () =>
          props.difficulties.find((d) => d.label === room.difficultyLabel) ??
          (props.difficulties[0] as D),
      );
      setWords(room.words ?? []);
      raceScore = 0;
      raceRewarded = false;
      setRaceDone(null);
      setRunId((n) => n + 1);
      setPhase("playing");
    },
    onEnd: () => {
      // time's up before my game ended: still count what I scored
      rewardRace(raceScore, 1);
      setPhase("pick");
    },
  });

  createEffect(() => {
    if (!props.open) {
      setPhase("pick");
      setResult(null);
      void race.leave();
      return;
    }
    setMode(untrack(() => props.initialMode) ?? "solo");
  });

  const createRace = async (): Promise<void> => {
    const d = difficulty();
    await race.create({
      durationSec: props.raceDurationSec?.(d) ?? raceLength(),
      difficultyLabel: d.label,
      wordListLabel: props.usesWordList === false ? "" : selected().label,
      words: props.usesWordList === false ? [] : await selected().getWords(),
    });
  };

  const leaveRace = (): void => {
    void race.leave();
    setPhase("pick");
  };

  const start = async (): Promise<void> => {
    setPhase("loading");
    const list =
      props.usesWordList === false ? [] : await selected().getWords();
    setWords(list);
    setRunId((n) => n + 1);
    setPhase("playing");
  };

  const finish = (r: MiniGameResult): void => {
    if (race.phase() !== "off") {
      race.reportFinished(r.score);
      raceScore = r.score;
      rewardRace(r.score, r.wave);
      setRaceDone(r.score);
      return;
    }
    setResult(r);
    setPhase("result");
    if (r.score > 0) sfx.finish();
    props.onResult?.(r.score, Math.max(1, r.wave));
    setClaim("pending");
    void claimMiniGameReward(props.gameId, r.score).then(setClaim);
  };

  return (
    <Show when={props.open}>
      <GameModalFrame
        layout={
          phase() === "playing" && race.phase() !== "results"
            ? "playing"
            : "pick"
        }
        onClose={() => props.onClose()}
        // typed with the on-screen keyboard too, so no "connect a keyboard" hint
        needsKeyboard={false}
      >
        <Switch>
          <Match when={race.phase() === "lobby"}>
            <ScoreRaceLobby race={race} onLeave={leaveRace} />
          </Match>
          <Match when={race.phase() === "results"}>
            <ScoreRaceResults race={race} onDone={leaveRace} />
          </Match>
          <Match when={phase() === "pick"}>
            <GamePickLayout
              header={
                <GameModalHeader
                  title={props.title}
                  onClose={() => props.onClose()}
                />
              }
              footer={
                <Show
                  when={mode() === "together"}
                  fallback={
                    <GameSetupPrimaryAction
                      text="Start game"
                      onClick={() => void start()}
                    />
                  }
                >
                  <ScoreRaceFooter
                    race={race}
                    onCreate={() => void createRace()}
                  />
                </Show>
              }
            >
              <GameSetupSection title="How to play" accent>
                <div class="grid gap-2 text-sm text-sub">{props.howToPlay}</div>
              </GameSetupSection>
              <ScoreRaceModeSection
                mode={mode()}
                onModeChange={setMode}
                lengths={
                  props.raceDurationSec === undefined ? RACE_LENGTHS : undefined
                }
                length={raceLength()}
                onLengthChange={setRaceLength}
              />
              <GameSetupSection title="Choose difficulty">
                <DifficultySegmented
                  options={props.difficulties}
                  selectedLabel={difficulty().label}
                  onSelect={(d) => setDifficulty(() => d)}
                />
              </GameSetupSection>
              <p class="mb-4 flex items-center gap-2 text-sm text-sub">
                <Fa icon="fa-coins" class="text-main" />
                Earn up to {MINI_GAME_MAX_COINS_PER_RUN} coins a game,{" "}
                {MINI_GAME_PAID_RUNS_PER_DAY} times a day.
              </p>
              <Show when={props.usesWordList !== false}>
                <GameSetupMore>
                  <GameSetupSection title="Choose a word list">
                    <WordListPicker
                      groups={GROUPS}
                      selectedId={selected().id}
                      onSelect={setSelected}
                    />
                  </GameSetupSection>
                </GameSetupMore>
              </Show>
            </GamePickLayout>
          </Match>

          <Match when={phase() === "loading"}>
            <div class="flex items-center justify-center py-12 text-sub">
              Loading…
            </div>
          </Match>

          <Match when={phase() === "playing"}>
            <Show when={race.phase() === "playing"}>
              <ScoreRaceBoard race={race} />
            </Show>
            <Show
              when={raceDone() !== null}
              fallback={
                // keyed on runId so each start remounts a fresh play area
                <For each={[runId()]}>
                  {() => (
                    <>
                      {props.play({
                        words: untrack(words),
                        difficulty: untrack(difficulty),
                        onFinish: finish,
                        onScore: (score) => {
                          if (race.phase() === "off") return;
                          raceScore = score;
                          race.reportScore(score);
                        },
                      })}
                    </>
                  )}
                </For>
              }
            >
              {(_) => (
                <div class="grid h-full place-content-center justify-items-center gap-3 p-6 text-center font-kid">
                  <Mascot mood="cheer" size={96} />
                  <div class="text-2xl font-bold text-text">
                    You scored {raceDone()}!
                  </div>
                  <div class="text-base text-sub">
                    Waiting for the others to finish…
                  </div>
                </div>
              )}
            </Show>
          </Match>

          <Match when={phase() === "result"}>
            <Show when={result()} keyed>
              {(r) => (
                <div class="relative grid justify-items-center gap-4 overflow-hidden p-6 text-center font-kid">
                  <Show when={(r.stars ?? 0) >= 2}>
                    <Confetti />
                  </Show>
                  <Mascot
                    mood={r.score > 0 ? "cheer" : "thinking"}
                    size={96}
                    class="animate-game-pop motion-reduce:animate-none"
                  />
                  <div class="text-2xl font-bold text-text">{r.headline}</div>
                  <Show when={r.stars !== undefined}>
                    <StarRating stars={r.stars ?? 0} />
                  </Show>
                  <div class="text-5xl font-bold text-main">{r.score}</div>
                  <div class="text-sm text-sub">points</div>
                  <div class="grid w-full grid-cols-2 gap-2">
                    <For each={r.stats}>
                      {(s) => (
                        <div class="rounded-xl bg-sub-alt p-3">
                          <div class="text-lg font-bold text-text">
                            {s.value}
                          </div>
                          <div class="text-xs text-sub">{s.label}</div>
                        </div>
                      )}
                    </For>
                  </div>
                  <div
                    class="min-h-6 text-base font-semibold"
                    aria-live="polite"
                  >
                    <Switch>
                      <Match when={claim() === "pending"}>
                        <span class="text-sub">Adding coins…</span>
                      </Match>
                      <Match
                        when={(() => {
                          const c = claim();
                          return c !== "pending" && c.kind === "coins"
                            ? c
                            : false;
                        })()}
                      >
                        {(c) => <CoinCountUp coins={c().coins} />}
                      </Match>
                      <Match
                        when={(() => {
                          const c = claim();
                          return c !== "pending" && c.kind === "capped";
                        })()}
                      >
                        <span class="text-sub">
                          You&apos;ve earned today&apos;s coins for this game -
                          play again just for fun!
                        </span>
                      </Match>
                      <Match
                        when={(() => {
                          const c = claim();
                          return c !== "pending" && c.kind === "signedOut";
                        })()}
                      >
                        <span class="text-sub">Sign in to earn coins.</span>
                      </Match>
                      <Match
                        when={(() => {
                          const c = claim();
                          return c !== "pending" && c.kind === "error";
                        })()}
                      >
                        <span class="text-sub">
                          Couldn&apos;t add coins - check your connection.
                        </span>
                      </Match>
                    </Switch>
                  </div>
                  <div class="flex flex-wrap justify-center gap-3">
                    <Button
                      chunky
                      size="lg"
                      active
                      fa={{ icon: "fa-redo-alt" }}
                      text="Play again"
                      onClick={() => void start()}
                    />
                    <Button
                      chunky
                      size="lg"
                      fa={{ icon: "fa-sliders-h" }}
                      text="Change settings"
                      onClick={() => setPhase("pick")}
                    />
                    <Button
                      chunky
                      size="lg"
                      fa={{ icon: "fa-times" }}
                      text="Done"
                      onClick={() => props.onClose()}
                    />
                  </div>
                </div>
              )}
            </Show>
          </Match>
        </Switch>
      </GameModalFrame>
    </Show>
  );
}
