import type Phaser from "phaser";

import {
  createEffect,
  createMemo,
  createSignal,
  JSXElement,
  onCleanup,
  Show,
} from "solid-js";

import { UserAvatar } from "../../components/common/UserAvatar";
import { getAuthenticatedUser } from "../../firebase";
import { LESSON_CHECKPOINT_MAX_WAVE } from "../../lessons/lesson-checkpoints";
import { DifficultySegmented } from "../components/DifficultySegmented";
import { GameModalFrame } from "../components/GameModalFrame";
import { GameModalHeader } from "../components/GameModalHeader";
import { GamePickLayout } from "../components/GamePickLayout";
import { GameSetupPrimaryAction } from "../components/GameSetupPrimaryAction";
import { GameSetupSection } from "../components/GameSetupSection";
import { groupWordListOptions } from "../components/groupWordListOptions";
import { WordListPicker } from "../components/WordListPicker";
import {
  getWordListOptions,
  WordListOption,
} from "../word-defender/systems/vocab-pool";
import {
  BALLOON_DIFFICULTIES,
  createBalloonPopGame,
  GameDifficulty,
} from "./game-config";

const OPTIONS = getWordListOptions();

const GROUPS = groupWordListOptions(OPTIONS);

type Props = {
  open: boolean;
  onClose: () => void;
  lessonWords?: string[];
  onResult?: (
    score: number,
    wave: number,
    difficultyLabel: string,
    wordListGroup: string,
  ) => void;
};

export function BalloonPopModal(props: Props): JSXElement {
  const [selected, setSelected] = createSignal<WordListOption>(
    OPTIONS[0] as WordListOption,
  );
  const [difficulty, setDifficulty] = createSignal<GameDifficulty>(
    BALLOON_DIFFICULTIES[0] as GameDifficulty,
  );
  const [phase, setPhase] = createSignal<"pick" | "loading" | "playing">(
    "pick",
  );
  const [avatarVisible, setAvatarVisible] = createSignal(false);
  let containerRef: HTMLDivElement | undefined;
  let game: Phaser.Game | null = null;

  const startGame = async (wordsOverride?: string[]): Promise<void> => {
    const easyDiff = BALLOON_DIFFICULTIES[0] as GameDifficulty;
    const onClose = props.onClose;
    const onResult = props.onResult;
    setPhase("loading");
    const words = wordsOverride ?? (await selected().getWords());
    setPhase("playing");
    await Promise.resolve();
    if (containerRef === undefined) return;
    const usedDifficulty =
      wordsOverride !== undefined ? easyDiff : difficulty();
    const usedGroup = selected().group;
    game = await createBalloonPopGame(
      containerRef,
      words,
      usedDifficulty,
      wordsOverride !== undefined ? LESSON_CHECKPOINT_MAX_WAVE : 0,
    );
    setAvatarVisible(true);
    game.events.on("game-avatar-visible", setAvatarVisible);
    game.events.on("game-result", (data: { score: number; wave: number }) => {
      setAvatarVisible(false);
      onResult?.(data.score, data.wave, usedDifficulty.label, usedGroup);
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
  };

  createEffect(() => {
    if (!props.open) {
      cleanup();
      return;
    }
    const words = props.lessonWords;
    if (words !== undefined) {
      void startGame(words);
    }
  });

  onCleanup(() => {
    cleanup();
  });

  const frameLayout = createMemo((): "pick" | "playing" | "compact" => {
    if (phase() === "playing") return "playing";
    if (phase() === "pick" && props.lessonWords === undefined) return "pick";
    return "compact";
  });

  return (
    <Show when={props.open}>
      <GameModalFrame layout={frameLayout()} onClose={() => props.onClose()}>
        <Show when={phase() === "pick" && props.lessonWords === undefined}>
          <GamePickLayout
            header={
              <GameModalHeader
                title="Balloon Pop"
                onClose={() => props.onClose()}
              />
            }
            footer={
              <GameSetupPrimaryAction
                text="Start game"
                onClick={() => void startGame()}
              />
            }
          >
            <GameSetupSection title="How to play" accent>
              <p class="text-em-sm text-sub">
                Type the words on balloons before they float away! Watch for 🌪️
                gust and 🎇 golden power-ups — type their word to grab one, then
                press ENTER to use it.
              </p>
            </GameSetupSection>
            <GameSetupSection title="Choose difficulty">
              <DifficultySegmented
                options={BALLOON_DIFFICULTIES}
                selectedLabel={difficulty().label}
                onSelect={(d) => setDifficulty(d)}
              />
            </GameSetupSection>
            <GameSetupSection title="Choose a word list">
              <WordListPicker
                groups={GROUPS}
                selectedId={selected().id}
                onSelect={setSelected}
              />
            </GameSetupSection>
          </GamePickLayout>
        </Show>

        <Show when={phase() === "loading"}>
          <div class="flex items-center justify-center py-12 text-sub">
            Loading…
          </div>
        </Show>

        <Show when={phase() === "playing"}>
          <Show when={avatarVisible() && getAuthenticatedUser()?.uid}>
            {(uid) => (
              <div class="pointer-events-none absolute bottom-8 left-8 z-10 flex flex-col items-center">
                <UserAvatar
                  uid={uid()}
                  class="h-11 w-11 rounded-full bg-sub-alt ring-2 ring-main"
                />
                <div class="-mt-1 h-10 w-7 rounded-t-xl bg-main/80"></div>
              </div>
            )}
          </Show>
          <div
            ref={(el) => {
              containerRef = el;
            }}
            class="h-full w-full"
          ></div>
        </Show>
      </GameModalFrame>
    </Show>
  );
}
