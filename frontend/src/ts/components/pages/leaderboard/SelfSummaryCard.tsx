import { XpLeaderboardEntry } from "@monkeytype/schemas/leaderboards";
import { formatDuration, intervalToDuration } from "date-fns";
import { JSXElement, Match, Show, Switch } from "solid-js";

import type { TableEntry } from "./table-entry";

import { getFormatting } from "../../../states/core";
import { cn } from "../../../utils/cn";
import { abbreviateNumber } from "../../../utils/numbers";
import { Fa } from "../../common/Fa";
import { LoadingCircle } from "../../common/LoadingCircle";
import { RankDisplay } from "./RankDisplay";

export function SelfSummaryCard(props: {
  type: "speed" | "xp" | "racewpm" | "raceacc";
  data?: TableEntry | null;
  classroomRank?: number;
  classroomPrimaryLabel?: string;
  friendsOnly: boolean;
  total: number | undefined;
  minWpm?: number;
  memoryDifference: number | undefined;
  isLbOptOut: boolean;
  isBanned: boolean;
  minTimeTyping: number;
  userTimeTyping: number;
  loading?: boolean;
}): JSXElement {
  const format = getFormatting;

  const rank = (): number | undefined => {
    if (props.classroomRank !== undefined) return props.classroomRank;
    if (props.data === undefined || props.data === null) return undefined;
    if (props.friendsOnly) {
      const friendsRank =
        "friendsRank" in props.data ? props.data.friendsRank : undefined;
      if (friendsRank !== undefined) return friendsRank;
    }
    return props.data.rank;
  };

  const percentileLabel = (): string | undefined => {
    const r = rank();
    if (r === undefined || props.total === undefined || props.total === 0) {
      return undefined;
    }
    if (r === 1) return "GOAT";
    const pct = (r / props.total) * 100;
    return `Top ${pct.toFixed(1)}%`;
  };

  const statLine = (): string | undefined => {
    if (props.classroomPrimaryLabel !== undefined) {
      return props.classroomPrimaryLabel;
    }
    if (props.data === undefined || props.data === null) return undefined;
    if (props.type === "speed" && "wpm" in props.data) {
      const d = props.data;
      return `${format().typingSpeed(d.wpm, { showDecimalPlaces: true })} ${format().typingSpeedUnit} · ${format().percentage(d.acc, { showDecimalPlaces: true })} acc`;
    }
    if ("bestRaceWpm" in props.data) {
      return props.type === "raceacc"
        ? `${Math.round(props.data.bestRaceAcc)}% acc`
        : `${Math.round(props.data.bestRaceWpm)} WPM`;
    }
    const d = props.data as XpLeaderboardEntry;
    const xp =
      d.totalXp < 1000 ? d.totalXp.toFixed(0) : abbreviateNumber(d.totalXp);
    return `${xp} XP`;
  };

  return (
    <div
      class={cn(
        "rounded-lg bg-sub-alt px-4 py-3",
        rank() !== undefined && "rank-row-self",
      )}
      data-ui-element="selfSummaryCard"
    >
      <Show
        when={!props.loading}
        fallback={<LoadingCircle class="mx-auto text-2xl" />}
      >
        <Show
          when={
            props.data !== null &&
            (props.data !== undefined || props.classroomRank !== undefined)
          }
          fallback={
            <div class="text-center text-sm text-sub">
              <Switch fallback="Not ranked yet">
                <Match when={props.isLbOptOut}>
                  You have opted out of the leaderboards.
                </Match>
                <Match when={props.isBanned}>Your account is banned.</Match>
                <Match when={props.userTimeTyping < props.minTimeTyping}>
                  Type{" "}
                  {formatDuration(
                    intervalToDuration({
                      start: 0,
                      end: props.minTimeTyping * 1000,
                    }),
                  )}{" "}
                  total to appear on global rankings.
                </Match>
                <Match when={props.minWpm !== undefined}>
                  Not qualified yet (min{" "}
                  {format().typingSpeed(props.minWpm, {
                    showDecimalPlaces: true,
                    suffix: ` ${format().typingSpeedUnit}`,
                  })}
                  ).
                </Match>
              </Switch>
            </div>
          }
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div class="text-sm font-medium text-sub">Your rank</div>
              <div class="flex items-baseline gap-2">
                <span class="rankings-heading text-2xl font-bold text-main">
                  <RankDisplay rank={rank()} />
                </span>
                <Show when={percentileLabel()}>
                  {(label) => <span class="text-sm text-sub">({label()})</span>}
                </Show>
              </div>
              <Show when={props.memoryDifference !== undefined}>
                <div class="mt-1 text-em-xs text-sub">
                  <Switch>
                    <Match when={props.memoryDifference === 0}>
                      = since last visit
                    </Match>
                    <Match when={(props.memoryDifference as number) > 0}>
                      <>
                        <Fa icon="fa-angle-up" fixedWidth />
                        {Math.abs(props.memoryDifference as number)} since last
                        visit
                      </>
                    </Match>
                    <Match when={(props.memoryDifference as number) < 0}>
                      <>
                        <Fa icon="fa-angle-down" fixedWidth />
                        {Math.abs(props.memoryDifference as number)} since last
                        visit
                      </>
                    </Match>
                  </Switch>
                </div>
              </Show>
            </div>
            <Show when={statLine()}>
              {(line) => (
                <div class="text-right text-sm font-semibold text-text">
                  {line()}
                </div>
              )}
            </Show>
          </div>
        </Show>
      </Show>
    </div>
  );
}
