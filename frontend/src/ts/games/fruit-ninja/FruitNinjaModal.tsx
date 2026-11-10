import type Phaser from "phaser";

import {
  createEffect,
  createMemo,
  createSignal,
  JSXElement,
  onCleanup,
  Show,
  untrack,
} from "solid-js";

import type { GameOverScene } from "./scenes/GameOverScene";

import { UserAvatar } from "../../components/common/UserAvatar";
import { getAuthenticatedUser } from "../../firebase";
import { DifficultySegmented } from "../components/DifficultySegmented";
import { GameModalFrame } from "../components/GameModalFrame";
import { GameModalHeader } from "../components/GameModalHeader";
import { GamePickLayout } from "../components/GamePickLayout";
import {
  GameResultOverlay,
  GameResultView,
} from "../components/GameResultOverlay";
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
import { ScoreRaceRoom } from "../shared/score-race";
import { waveAccuracy, WaveEnd, waveStars } from "../shared/wave-result";
import {
  getWordListOptions,
  WordListOption,
} from "../word-defender/systems/vocab-pool";
import {
  createFruitNinjaGame,
  FRUIT_NINJA_DIFFICULTIES,
  GameDifficulty,
} from "./game-config";

const toView = (d: WaveEnd): GameResultView => ({
  headline:
    d.cleared === true
      ? "All sliced!"
      : d.wave >= 6
        ? "Fruit master!"
        : "Nice slicing!",
  score: d.score,
  stars: waveStars(d),
  stats: [
    { label: "wave reached", value: String(d.wave) },
    { label: "accuracy", value: `${waveAccuracy(d)}%` },
    { label: "fruit sliced", value: String(d.hits) },
    { label: "missed keys", value: String(d.misses) },
  ],
});

const OPTIONS = getWordListOptions();

const GROUPS = groupWordListOptions(OPTIONS);

/** Match lengths for playing together. */
const RACE_LENGTHS = [60, 120, 180] as const;

type Props = {
  open: boolean;
  onClose: () => void;
  initialMode?: "solo" | "together";
  onResult?: (
    score: number,
    wave: number,
    difficultyLabel: string,
    wordListGroup: string,
  ) => void;
};

export function FruitNinjaModal(props: Props): JSXElement {
  const [selected, setSelected] = createSignal<WordListOption>(
    OPTIONS[0] as WordListOption,
  );
  const [difficulty, setDifficulty] = createSignal<GameDifficulty>(
    FRUIT_NINJA_DIFFICULTIES[0] as GameDifficulty,
  );
  const [phase, setPhase] = createSignal<"pick" | "loading" | "playing">(
    "pick",
  );
  const [avatarVisible, setAvatarVisible] = createSignal(false);
  const [result, setResult] = createSignal<GameResultView | null>(null);
  let containerRef: HTMLDivElement | undefined;
  let game: Phaser.Game | null = null;
  const [mode, setMode] = createSignal<"solo" | "together">("solo");
  const [raceLength, setRaceLength] = createSignal<number>(RACE_LENGTHS[0]);
  /** my game in a match: latest score/wave, and whether it has ended */
  let raceLive: {
    score: number;
    wave: number;
    done: boolean;
    record: (score: number, wave: number) => void;
  } | null = null;

  const startRace = async (room: ScoreRaceRoom): Promise<void> => {
    const onResult = props.onResult;
    const onClose = props.onClose;
    setResult(null);
    setPhase("playing");
    await Promise.resolve();
    if (containerRef === undefined) return;
    const usedDifficulty =
      FRUIT_NINJA_DIFFICULTIES.find((d) => d.label === room.difficultyLabel) ??
      (FRUIT_NINJA_DIFFICULTIES[0] as GameDifficulty);
    const usedGroup =
      OPTIONS.find((o) => o.label === room.wordListLabel)?.group ??
      selected().group;
    game = await createFruitNinjaGame(
      containerRef,
      room.words ?? [],
      usedDifficulty,
    );
    const live = {
      score: 0,
      wave: 1,
      done: false,
      record: (score: number, wave: number) =>
        onResult?.(score, wave, usedDifficulty.label, usedGroup),
    };
    raceLive = live;
    setAvatarVisible(true);
    game.events.on("game-avatar-visible", setAvatarVisible);
    game.events.on("ui-score", (score: number) => {
      live.score = score;
      race.reportScore(score);
    });
    game.events.on("ui-wave", (wave: number) => {
      live.wave = wave;
    });
    game.events.on("game-result", (data: { score: number; wave: number }) => {
      setAvatarVisible(false);
      if (live.done) return;
      live.done = true;
      race.reportFinished(data.score);
      live.record(data.score, data.wave);
    });
    game.events.on("game-over-screen", (d: WaveEnd) => {
      setResult(toView(d));
    });
    game.events.on("exit-game", () => {
      onClose();
    });
  };

  const race = useScoreRace({
    gameId: "fruit-ninja",
    title: "Fruit Ninja",
    onStart: (room) => void startRace(room),
    onEnd: () => {
      // time's up while I was still playing: count what I scored
      const live = raceLive;
      raceLive = null;
      if (live !== null && !live.done) live.record(live.score, live.wave);
      if (game !== null) {
        game.destroy(true);
        game = null;
      }
      setAvatarVisible(false);
      setResult(null);
    },
  });

  const createRace = async (): Promise<void> => {
    const option = selected();
    await race.create({
      durationSec: raceLength(),
      difficultyLabel: difficulty().label,
      wordListLabel: option.label,
      words: await option.getWords(),
    });
  };

  const leaveRace = (): void => {
    void race.leave();
    setPhase("pick");
  };

  const startGame = async (): Promise<void> => {
    const onClose = props.onClose;
    const onResult = props.onResult;
    setPhase("loading");
    const words = await selected().getWords();
    setPhase("playing");
    await Promise.resolve();
    if (containerRef === undefined) return;
    const usedDifficulty = difficulty();
    const usedGroup = selected().group;
    game = await createFruitNinjaGame(containerRef, words, usedDifficulty);
    setAvatarVisible(true);
    game.events.on("game-avatar-visible", setAvatarVisible);
    game.events.on("game-result", (data: { score: number; wave: number }) => {
      setAvatarVisible(false);
      onResult?.(data.score, data.wave, usedDifficulty.label, usedGroup);
    });
    game.events.on("game-over-screen", (d: WaveEnd) => {
      setResult(toView(d));
    });
    game.events.on("exit-game", () => {
      onClose();
    });
  };

  const cleanup = (): void => {
    if (game !== null) {
      game.destroy(true);
      game = null;
    }
    setPhase("pick");
    setAvatarVisible(false);
    setResult(null);
  };

  const playAgain = (): void => {
    setResult(null);
    const over = game?.scene.getScene("GameOver") as GameOverScene | null;
    over?.playAgain();
  };

  createEffect(() => {
    if (!props.open) {
      cleanup();
      void race.leave();
      return;
    }
    setMode(untrack(() => props.initialMode) ?? "solo");
  });

  onCleanup(() => {
    cleanup();
  });

  const frameLayout = createMemo((): "pick" | "playing" | "compact" => {
    if (race.phase() === "lobby" || race.phase() === "results") {
      return "compact";
    }
    if (phase() === "playing") return "playing";
    if (phase() === "pick") return "pick";
    return "compact";
  });

  return (
    <Show when={props.open}>
      <GameModalFrame layout={frameLayout()} onClose={() => props.onClose()}>
        <Show when={phase() === "pick" && race.phase() === "off"}>
          <GamePickLayout
            header={
              <GameModalHeader
                title="Fruit Ninja"
                onClose={() => props.onClose()}
              />
            }
            footer={
              <Show
                when={mode() === "together"}
                fallback={
                  <GameSetupPrimaryAction
                    text="Start game"
                    onClick={() => void startGame()}
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
              <p class="text-em-sm text-sub">
                Type the words on falling fruits before they hit the ground!
              </p>
            </GameSetupSection>
            <GameSetupSection title="Choose difficulty">
              <DifficultySegmented
                options={FRUIT_NINJA_DIFFICULTIES}
                selectedLabel={difficulty().label}
                onSelect={(d) => setDifficulty(d)}
              />
            </GameSetupSection>
            <ScoreRaceModeSection
              mode={mode()}
              onModeChange={setMode}
              lengths={RACE_LENGTHS}
              length={raceLength()}
              onLengthChange={setRaceLength}
            />
            <GameSetupMore>
              <GameSetupSection title="Choose a word list">
                <WordListPicker
                  groups={GROUPS}
                  selectedId={selected().id}
                  onSelect={setSelected}
                />
              </GameSetupSection>
            </GameSetupMore>
          </GamePickLayout>
        </Show>

        <Show when={race.phase() === "lobby"}>
          <ScoreRaceLobby race={race} onLeave={leaveRace} />
        </Show>

        <Show when={race.phase() === "results"}>
          <ScoreRaceResults race={race} onDone={leaveRace} />
        </Show>

        <Show when={phase() === "loading"}>
          <div class="flex items-center justify-center py-12 text-sub">
            Loading…
          </div>
        </Show>

        <Show when={phase() === "playing" && race.phase() !== "results"}>
          <Show when={race.phase() === "playing"}>
            <ScoreRaceBoard race={race} />
          </Show>
          <Show when={avatarVisible() && getAuthenticatedUser()?.uid}>
            {(uid) => (
              <div class="pointer-events-none absolute right-[32px] bottom-[26px] z-10">
                <UserAvatar
                  uid={uid()}
                  class="h-7 w-7 rounded-full bg-sub-alt ring-2 ring-main"
                />
              </div>
            )}
          </Show>
          <div
            ref={(el) => {
              containerRef = el;
            }}
            class="h-full w-full"
          ></div>
          <Show when={result()}>
            {(r) => (
              <GameResultOverlay
                result={r()}
                onPlayAgain={race.phase() === "off" ? playAgain : undefined}
                note={
                  race.phase() === "off"
                    ? undefined
                    : "Waiting for the others to finish…"
                }
                onExit={() => props.onClose()}
              />
            )}
          </Show>
        </Show>
      </GameModalFrame>
    </Show>
  );
}
