import { For, JSXElement, Show } from "solid-js";

import {
  checkpointCardNumber,
  lessonCardNumber,
  rowItemsFor,
} from "../../../lessons/lesson-checkpoint-order";
import {
  HomeRowCheckpoint,
  LESSON_GROUP_CHECKPOINTS,
} from "../../../lessons/lesson-checkpoints";
import { LESSON_GROUP_INTRO_VIDEOS } from "../../../lessons/lesson-intro-videos";
import { GAME_PREFIX, LessonProgress } from "../../../lessons/lesson-progress";
import { LessonGroup } from "../../../lessons/lessons-data";
import { showNoticeNotification } from "../../../states/notifications";
import { cn } from "../../../utils/cn";
import { Fa } from "../../common/Fa";
import { showLessonIntroVideo } from "../../modals/LessonIntroVideoModal";
import { CheckpointCard } from "./CheckpointCard";
import { groupCompletedCount, groupStarTotals } from "./lesson-group-progress";
import { LessonCard } from "./LessonCard";

export function LessonGroupSection(props: {
  group: LessonGroup;
  collapsed: boolean;
  onToggle: () => void;
  isCurrent: boolean;
  isFuture: boolean;
  isComplete: boolean;
  progressFor: (id: string) => LessonProgress | undefined;
  isLessonLocked: (id: string) => boolean;
  getLessonLockMessage: (id: string) => string | undefined;
  frontierLessonId: string | undefined;
  frontierCheckpointTarget:
    | { groupId: string; gameType: HomeRowCheckpoint["gameType"] }
    | undefined;
  lessonGameLoading: boolean;
  onCheckpointPlay: (group: LessonGroup, checkpoint: HomeRowCheckpoint) => void;
  grade?: string;
  isGroupComplete: (group: LessonGroup) => boolean;
  onGroupGame: (group: LessonGroup, type: "balloon" | "defender") => void;
}): JSXElement {
  const stars = (): { earned: number; max: number } =>
    groupStarTotals(props.group, props.progressFor);
  const doneCount = (): number =>
    groupCompletedCount(props.group, props.progressFor);

  return (
    <div id={props.group.id}>
      <button
        type="button"
        class={cn(
          "flex w-full items-center justify-between rounded-xl px-2 py-2 text-left transition-colors hover:bg-sub-alt",
          props.isCurrent ? "ring-1 ring-main/50" : "",
          props.isFuture ? "opacity-80" : "",
        )}
        onClick={() => props.onToggle()}
      >
        <div class="flex items-center gap-2 text-sub">
          <Show
            when={props.isComplete}
            fallback={<Fa icon={props.group.icon} size={0.9} />}
          >
            <Fa icon="fa-check-circle" class="text-main" size={0.9} />
          </Show>
          <span class="font-medium text-text">{props.group.name}</span>
          <Show when={props.isCurrent}>
            <span class="rounded bg-main px-1.5 py-0.5 text-em-xs text-bg">
              You are here
            </span>
          </Show>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-em-xs text-sub" title="Stars earned in this group">
            ★ {stars().earned}/{stars().max}
          </span>
          <span class="text-em-xs text-sub">
            {doneCount()}/{props.group.lessons.length}
          </span>
          <div class="h-1 w-10 rounded-full bg-bg">
            <div
              class="h-1 rounded-full bg-main transition-[width]"
              style={{
                width: `${Math.min(100, (doneCount() / props.group.lessons.length) * 100)}%`,
              }}
            ></div>
          </div>
          <Fa
            icon="fa-chevron-down"
            size={0.8}
            class={cn(
              "text-sub transition-transform duration-200",
              props.collapsed ? "-rotate-90" : "",
            )}
          />
        </div>
      </button>
      <Show when={!props.collapsed}>
        <p class="mt-1 mb-2 pl-2 text-em-xs text-sub">
          {props.group.description}
        </p>
        <div class="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
          <Show when={LESSON_GROUP_INTRO_VIDEOS[props.group.id]} keyed>
            {(videoId) => (
              <button
                type="button"
                class="grid min-h-48 cursor-pointer grid-rows-[auto_1fr_auto] overflow-hidden rounded-2xl border border-sub-alt bg-sub-alt text-left text-text shadow-md transition-all hover:-translate-y-0.5 hover:border-main hover:shadow-lg"
                onClick={() => showLessonIntroVideo(videoId)}
              >
                <div class="px-4 pt-3 text-2xl font-bold text-sub">▶</div>
                <div class="flex items-center justify-center px-3 py-2">
                  <Fa icon="fa-play-circle" class="text-main" size={2.8} />
                </div>
                <div class="border-t border-bg px-3 py-2.5 text-center">
                  <div class="lesson-card-title font-medium">Intro video</div>
                  <div class="mt-0.5 text-em-xs text-sub">
                    watch before you start
                  </div>
                </div>
              </button>
            )}
          </Show>
          <For each={rowItemsFor(props.group)}>
            {(item) =>
              // oxlint-disable-next-line solid/prefer-show -- row kind is fixed per static curriculum config
              item.kind === "lesson" ? (
                <LessonCard
                  lesson={item.lesson}
                  progress={props.progressFor(item.lesson.id)}
                  number={lessonCardNumber(item.lesson.id)}
                  next={props.frontierLessonId === item.lesson.id}
                  locked={props.isLessonLocked(item.lesson.id)}
                  lockedMessage={props.getLessonLockMessage(item.lesson.id)}
                  grade={props.grade}
                />
              ) : (
                <CheckpointCard
                  group={props.group}
                  checkpoint={item.checkpoint}
                  number={checkpointCardNumber(props.group, item.checkpoint)}
                  next={
                    props.frontierCheckpointTarget?.groupId ===
                      props.group.id &&
                    props.frontierCheckpointTarget?.gameType ===
                      item.checkpoint.gameType
                  }
                  progressFor={props.progressFor}
                  loading={props.lessonGameLoading}
                  onPlay={props.onCheckpointPlay}
                />
              )
            }
          </For>
        </div>
        <Show when={LESSON_GROUP_CHECKPOINTS[props.group.id] === undefined}>
          <div class="mb-2 flex gap-3 pl-2">
            <For
              each={[
                {
                  gameId: "balloon-pop" as const,
                  label: "Balloon Pop",
                  icon: "fa-circle" as const,
                  type: "balloon" as const,
                },
                {
                  gameId: "word-defender" as const,
                  label: "Word Defender",
                  icon: "fa-rocket" as const,
                  type: "defender" as const,
                },
              ]}
            >
              {(g) => {
                const key = (): string =>
                  `${GAME_PREFIX}${props.group.id}:${g.gameId}`;
                const done = (): boolean =>
                  props.progressFor(key())?.completed === true;
                const locked = (): boolean =>
                  !props.isGroupComplete(props.group);
                return (
                  <button
                    type="button"
                    class={cn(
                      "flex items-center gap-2 rounded px-3 py-2 text-em-sm transition-colors",
                      locked()
                        ? "cursor-not-allowed bg-sub-alt text-sub opacity-50"
                        : "cursor-pointer bg-sub-alt text-text hover:bg-text hover:text-bg",
                    )}
                    onClick={() => {
                      if (locked()) {
                        showNoticeNotification(
                          "Finish all lessons in this group first",
                        );
                        return;
                      }
                      props.onGroupGame(props.group, g.type);
                    }}
                    disabled={props.lessonGameLoading}
                  >
                    <Show
                      when={locked()}
                      fallback={
                        <Show
                          when={done()}
                          fallback={<Fa icon={g.icon} size={0.8} />}
                        >
                          <Fa
                            icon="fa-check-circle"
                            class="text-main"
                            size={0.8}
                          />
                        </Show>
                      }
                    >
                      <Fa icon="fa-lock" size={0.8} />
                    </Show>
                    {g.label}
                  </button>
                );
              }}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  );
}
