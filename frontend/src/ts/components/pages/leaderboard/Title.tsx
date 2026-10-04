import { UTCDateMini } from "@date-fns/utc/date/mini";
import { endOfWeek, startOfDay, startOfWeek, subDays } from "date-fns";
import { format as dateFormat } from "date-fns/format";
import { createMemo, JSXElement, Show } from "solid-js";

import {
  ClassroomSelectionType,
  isClassroomType,
  Selection,
} from "../../../states/leaderboard-selection";
import { cn } from "../../../utils/cn";
import { capitalizeFirstLetter } from "../../../utils/strings";
import { Button } from "../../common/Button";
import { H2 } from "../../common/Headers";
import { NextUpdate } from "./NextUpdate";

export function Title(props: {
  selection: Selection;
  onPreviousSelect: () => void;
}): JSXElement {
  const eyebrow = createMemo(() =>
    isClassroomType(props.selection.type)
      ? "School rankings"
      : "Global rankings",
  );

  const title = createMemo(() => {
    if (isClassroomType(props.selection.type)) {
      const cs = props.selection as ClassroomSelectionType;
      const metric =
        cs.metric === "wpm"
          ? "Typing speed"
          : cs.metric === "racewpm"
            ? "Race speed"
            : cs.metric === "raceacc"
              ? "Race accuracy"
              : cs.metric === "games"
                ? "Game scores"
                : cs.metric === "xpAllTime"
                  ? "All-time XP"
                  : "Weekly XP";
      const scope =
        cs.type === "class"
          ? (cs.classId ?? "Your class")
          : cs.type === "grade"
            ? (cs.grade ?? "Your grade")
            : "Whole school";
      return `${scope} · ${metric}`;
    }

    const type =
      props.selection.type === "allTime"
        ? "All-time speed"
        : props.selection.type === "weekly"
          ? "Weekly XP"
          : "Daily speed";

    const language = capitalizeFirstLetter(props.selection.language ?? "");

    const mode =
      props.selection.type !== "weekly"
        ? ` · ${props.selection.mode2}s ${capitalizeFirstLetter(props.selection.mode ?? "")}`
        : "";
    return `${type} · ${language}${mode}`;
  });

  const subTitle = createMemo(() => {
    const japanDateFormat = "EEEE, do MMMM yyyy";
    const japanNow = new UTCDateMini(Date.now() + 9 * 60 * 60 * 1000);

    if (props.selection.type === "daily") {
      let timestamp = startOfDay(japanNow);
      if (props.selection.previous) {
        timestamp = subDays(timestamp, 1);
      }
      return {
        dateString: `${dateFormat(timestamp, japanDateFormat)} JST`,
        buttonText: props.selection.previous ? "Show today" : "Show yesterday",
      };
    } else if (props.selection.type === "weekly") {
      let timestamp = startOfWeek(japanNow, { weekStartsOn: 1 });
      if (props.selection.previous) {
        timestamp = subDays(timestamp, 7);
      }
      const endTimestamp = endOfWeek(timestamp, { weekStartsOn: 1 });

      return {
        dateString: `${dateFormat(timestamp, japanDateFormat)} – ${dateFormat(endTimestamp, japanDateFormat)} JST`,
        buttonText: props.selection.previous
          ? "Show this week"
          : "Show last week",
      };
    }
    return null;
  });

  const isWpmMetric = createMemo(
    () =>
      isClassroomType(props.selection.type) &&
      (props.selection as ClassroomSelectionType).metric === "wpm",
  );

  const resetType = createMemo((): Selection["type"] | undefined => {
    if (isClassroomType(props.selection.type)) {
      const m = (props.selection as ClassroomSelectionType).metric;
      if (m === "xp" || m === "wpm") return "weekly";
      return undefined;
    }
    if (
      props.selection.type === "daily" ||
      props.selection.type === "weekly" ||
      props.selection.type === "allTime"
    ) {
      return props.selection.type;
    }
    return undefined;
  });

  const description = createMemo(() => {
    if (!isClassroomType(props.selection.type)) {
      return props.selection.type === "weekly"
        ? "See who earned the most XP this week."
        : "Compare your best typing scores with everyone.";
    }

    const selection = props.selection as ClassroomSelectionType;
    const scope =
      selection.type === "class"
        ? `Students in ${selection.classId ?? "your class"}`
        : selection.type === "grade"
          ? `Students in ${selection.grade ?? "your grade"}`
          : "Everyone at your school";
    const metric =
      selection.metric === "xpAllTime"
        ? "total XP"
        : selection.metric === "wpm"
          ? "best typing speed"
          : selection.metric === "racewpm"
            ? "best race speed"
            : selection.metric === "raceacc"
              ? "best race accuracy"
              : selection.metric === "games"
                ? "game high scores"
                : "XP this week";
    return `${scope}, ranked by ${metric}.`;
  });

  return (
    <header class="grid gap-2">
      <p class="text-sm font-semibold tracking-wide text-main uppercase">
        {eyebrow()}
      </p>
      <H2
        text={title()}
        class="rankings-heading p-0 text-2xl text-text md:text-3xl"
      />
      <p class="max-w-2xl text-sub">{description()}</p>
      <Show when={isWpmMetric()}>
        <p class="text-sm text-sub">
          Uses {(props.selection as ClassroomSelectionType).mode2 ?? "30"}{" "}
          second English tests only.
        </p>
      </Show>
      <div class="flex flex-wrap items-center gap-2">
        <Show when={resetType()}>
          {(type) => (
            <NextUpdate
              type={type()}
              class="rounded-full bg-sub-alt px-3 py-1 text-sm text-sub"
            />
          )}
        </Show>
        <Show when={subTitle() !== null}>
          <span class="text-sm text-sub">{subTitle()?.dateString}</span>
          <Button
            text={subTitle()?.buttonText}
            variant="text"
            class={cn("text-sm")}
            onClick={props.onPreviousSelect}
            fa={{
              icon: props.selection.previous ? "fa-forward" : "fa-backward",
              variant: "solid",
            }}
          />
        </Show>
      </div>
    </header>
  );
}
