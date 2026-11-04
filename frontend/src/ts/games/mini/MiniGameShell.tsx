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
import { WordListPicker } from "../components/WordListPicker";
import {
  getWordListOptions,
  WordListOption,
} from "../word-defender/systems/vocab-pool";
import {
  claimMiniGameReward,
  MiniGameClaim,
  MiniGameId,
  MINI_GAME_MAX_COINS_PER_RUN,
  MINI_GAME_PAID_RUNS_PER_DAY,
} from "./mini-game-reward";

const OPTIONS = getWordListOptions();
const GROUPS = groupWordListOptions(OPTIONS);

export type MiniGameResult = {
  score: number;
  /** Rounds/levels reached - used for the game-of-the-day bonus (min 1). */
  wave: number;
  stats: { label: string; value: string }[];
  headline: string;
};

export type MiniGamePlayProps<D> = {
  words: string[];
  difficulty: D;
  onFinish: (result: MiniGameResult) => void;
};

/**
 * Shared setup -> play -> result flow for the DOM mini games. Each game only
 * renders its play area; this shell handles word lists, difficulty, the
 * result screen and the coin claim.
 */
export function MiniGameShell<D extends DifficultyOption>(props: {
  open: boolean;
  onClose: () => void;
  gameId: MiniGameId;
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

  createEffect(() => {
    if (!props.open) {
      setPhase("pick");
      setResult(null);
    }
  });

  const start = async (): Promise<void> => {
    setPhase("loading");
    const list =
      props.usesWordList === false ? [] : await selected().getWords();
    setWords(list);
    setRunId((n) => n + 1);
    setPhase("playing");
  };

  const finish = (r: MiniGameResult): void => {
    setResult(r);
    setPhase("result");
    props.onResult?.(r.score, Math.max(1, r.wave));
    setClaim("pending");
    void claimMiniGameReward(props.gameId, r.score).then(setClaim);
  };

  return (
    <Show when={props.open}>
      <GameModalFrame
        layout={phase() === "playing" ? "playing" : "pick"}
        onClose={() => props.onClose()}
      >
        <Switch>
          <Match when={phase() === "pick"}>
            <GamePickLayout
              header={
                <GameModalHeader
                  title={props.title}
                  onClose={() => props.onClose()}
                />
              }
              footer={
                <GameSetupPrimaryAction
                  text="Start game"
                  onClick={() => void start()}
                />
              }
            >
              <GameSetupSection title="How to play" accent>
                <div class="grid gap-2 text-sm text-sub">{props.howToPlay}</div>
              </GameSetupSection>
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
            {/* keyed on runId so each start remounts a fresh play area */}
            <For each={[runId()]}>
              {() => (
                <>
                  {props.play({
                    words: untrack(words),
                    difficulty: untrack(difficulty),
                    onFinish: finish,
                  })}
                </>
              )}
            </For>
          </Match>

          <Match when={phase() === "result"}>
            <Show when={result()} keyed>
              {(r) => (
                <div class="grid justify-items-center gap-4 p-6 text-center font-kid">
                  <Mascot mood={r.score > 0 ? "cheer" : "thinking"} size={96} />
                  <div class="text-2xl font-bold text-text">{r.headline}</div>
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
                        {(c) => (
                          <span class="text-main">
                            <Fa icon="fa-coins" class="mr-1.5" />+{c().coins}{" "}
                            coins!
                          </span>
                        )}
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
