import { JSXElement, Show } from "solid-js";

import {
  HOME_ROW_GAME_IDS,
  HomeRowCheckpoint,
} from "../../../lessons/lesson-checkpoints";
import { GAME_PREFIX, LessonProgress } from "../../../lessons/lesson-progress";
import { LessonGroup } from "../../../lessons/lessons-data";
import { showNoticeNotification } from "../../../states/notifications";
import { cn } from "../../../utils/cn";
import { Fa } from "../../common/Fa";
import { LessonStars } from "./LessonStars";

function checkpointSubtitle(checkpoint: HomeRowCheckpoint): string {
  return checkpoint.gameType === "toss"
    ? "Required · full round"
    : "Required · 3 waves";
}

export function CheckpointCard(props: {
  group: LessonGroup;
  checkpoint: HomeRowCheckpoint;
  progressFor: (id: string) => LessonProgress | undefined;
  number: number;
  loading: boolean;
  next?: boolean;
  onPlay: (group: LessonGroup, checkpoint: HomeRowCheckpoint) => void;
}): JSXElement {
  const key = (): string =>
    `${GAME_PREFIX}${props.group.id}:${HOME_ROW_GAME_IDS[props.checkpoint.gameType]}`;
  const reviewLessonIds = (): string[] =>
    props.checkpoint.reviewLessonIds === "all"
      ? props.group.lessons.map((l) => l.id)
      : props.checkpoint.reviewLessonIds;
  const locked = (): boolean =>
    !reviewLessonIds().every((id) => props.progressFor(id)?.completed === true);
  const done = (): boolean => props.progressFor(key())?.completed === true;
  const isNext = (): boolean => props.next === true && !locked() && !done();

  const onClick = (): void => {
    if (locked()) {
      showNoticeNotification("Finish the lessons above first");
      return;
    }
    props.onPlay(props.group, props.checkpoint);
  };

  return (
    <button
      type="button"
      class={cn(
        "relative grid min-h-48 grid-rows-[auto_1fr_auto] overflow-hidden rounded-2xl border border-sub-alt bg-sub-alt text-left shadow-md transition-all",
        locked()
          ? "cursor-not-allowed text-sub opacity-55"
          : "cursor-pointer text-text hover:-translate-y-0.5 hover:border-main hover:shadow-lg",
        isNext() ? "lesson-card-next ring-2 ring-main" : "",
      )}
      onClick={onClick}
      disabled={props.loading}
    >
      <div class="flex items-start justify-between px-4 pt-3">
        <span class="text-2xl font-bold text-sub tabular-nums">
          {String(props.number).padStart(2, "0")}
        </span>
        <Show
          when={locked()}
          fallback={
            <Show
              when={done()}
              fallback={
                <Fa icon={props.checkpoint.icon} class="text-sub" size={0.9} />
              }
            >
              <Fa icon="fa-check-circle" class="text-main" size={0.9} />
            </Show>
          }
        >
          <Fa icon="fa-lock" class="text-sub" size={0.9} />
        </Show>
      </div>
      <div class="flex flex-col items-center justify-center gap-3 px-3 py-2">
        <div class="relative">
          <Fa
            icon={locked() ? "fa-lock" : props.checkpoint.icon}
            class={locked() ? "text-sub" : "text-main"}
            size={2.35}
          />
          <Show when={!locked() && !done()}>
            <span class="absolute -top-1 -right-2 rounded-full bg-main px-1.5 py-0.5 text-[0.55rem] font-bold text-bg">
              game
            </span>
          </Show>
        </div>
        <Show when={done()}>
          <LessonStars count={3} />
        </Show>
        <Show when={isNext()}>
          <span class="rounded-full bg-main px-3 py-1 text-em-xs font-bold text-bg">
            Do this next
          </span>
        </Show>
      </div>
      <div class="border-t border-bg px-3 py-2.5 text-center">
        <div
          class="lesson-card-title truncate font-medium"
          title={props.checkpoint.label}
        >
          {props.checkpoint.label}
        </div>
        <div class="mt-0.5 text-em-xs text-sub">
          <Show when={done()} fallback={checkpointSubtitle(props.checkpoint)}>
            best {props.progressFor(key())?.bestScore ?? 0}
          </Show>
        </div>
      </div>
    </button>
  );
}
