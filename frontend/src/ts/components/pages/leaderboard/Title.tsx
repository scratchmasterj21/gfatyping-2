import { UTCDateMini } from "@date-fns/utc/date/mini";
import { endOfWeek, startOfDay, startOfWeek, subDays } from "date-fns";
import { format as dateFormat } from "date-fns/format";
import { createMemo, JSXElement, Show } from "solid-js";

import {
  ClassroomSelectionType,
  isClassroomType,
  Selection,
} from "../../../states/leaderboard-selection";
import { capitalizeFirstLetter } from "../../../utils/strings";
import { Button } from "../../common/Button";
import { H2 } from "../../common/Headers";
import { NextUpdate } from "./NextUpdate";

export function Title(props: {
  selection: Selection;
  onPreviousSelect: () => void;
}): JSXElement {
  const title = createMemo(() => {
    if (isClassroomType(props.selection.type)) {
      const cs = props.selection as ClassroomSelectionType;
      const metric =
        cs.metric === "wpm"
          ? "WPM"
          : cs.metric === "racewpm"
            ? "Race WPM"
            : cs.metric === "raceacc"
              ? "Race Accuracy"
              : cs.metric === "games"
                ? "Games"
                : cs.metric === "xpAllTime"
                  ? "All-time XP"
                  : "XP";
      const scope =
        cs.type === "class"
          ? (cs.classId ?? "Class")
          : cs.type === "grade"
            ? (cs.grade ?? "Grade")
            : "School";
      return `${scope} ${metric} Leaderboard`;
    }

    const type =
      props.selection.type === "allTime"
        ? "All-time"
        : props.selection.type === "weekly"
          ? "Weekly XP"
          : "Daily";

    const friend = props.selection.friendsOnly ? "Friends " : "";

    const language = capitalizeFirstLetter(props.selection.language ?? "");

    const mode =
      props.selection.type !== "weekly"
        ? ` ${capitalizeFirstLetter(props.selection.mode ?? "")} ${props.selection.mode2}`
        : "";
    return `${type} ${language} ${mode} ${friend}Leaderboard`;
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
        buttonText: props.selection.previous ? "show today" : "show yesterday",
      };
    } else if (props.selection.type === "weekly") {
      let timestamp = startOfWeek(japanNow, { weekStartsOn: 1 });
      if (props.selection.previous) {
        timestamp = subDays(timestamp, 7);
      }
      const endTimestamp = endOfWeek(timestamp, { weekStartsOn: 1 });

      return {
        dateString: `${dateFormat(timestamp, japanDateFormat)} - ${dateFormat(endTimestamp, japanDateFormat)} JST`,
        buttonText: props.selection.previous
          ? "show this week"
          : "show last week",
      };
    }
    return null;
  });

  const isWpmMetric = createMemo(
    () =>
      isClassroomType(props.selection.type) &&
      (props.selection as ClassroomSelectionType).metric === "wpm",
  );

  const isWeeklyPeriodMetric = createMemo(
    () =>
      isClassroomType(props.selection.type) &&
      ["wpm", "xp"].includes(
        (props.selection as ClassroomSelectionType).metric ?? "",
      ),
  );

  return (
    <div>
      <H2
        text={title()}
        class="p-0 text-2xl text-text md:text-3xl xl:text-4xl"
      />
      <Show when={isWpmMetric()}>
        <div class="text-sub">
          ranked by {(props.selection as ClassroomSelectionType).mode2 ?? "30"}s
          English test scores only
        </div>
      </Show>
      <Show when={isWeeklyPeriodMetric()}>
        <NextUpdate type="weekly" />
      </Show>
      <Show when={subTitle() !== null}>
        <div class="flex items-center gap-2">
          <div class="text-sub">{subTitle()?.dateString}</div>
          <div class="h-[1.75em] w-[0.25em] rounded bg-sub-alt"></div>
          <Button
            text={subTitle()?.buttonText}
            variant="text"
            onClick={props.onPreviousSelect}
            fa={{
              icon: props.selection.previous ? "fa-forward" : "fa-backward",
              variant: "solid",
            }}
          />
        </div>
      </Show>
    </div>
  );
}
