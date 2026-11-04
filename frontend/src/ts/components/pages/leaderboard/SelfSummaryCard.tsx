import { XpLeaderboardEntry } from "@monkeytype/schemas/leaderboards";
import { formatDuration, intervalToDuration } from "date-fns";
import { JSXElement, Match, Show, Switch } from "solid-js";

import type { TableEntry } from "./table-entry";

import { getFormatting } from "../../../states/core";
import { cn } from "../../../utils/cn";
import { abbreviateNumber } from "../../../utils/numbers";
import { Button } from "../../common/Button";
import { Fa } from "../../common/Fa";
import { LoadingCircle } from "../../common/LoadingCircle";
import { Mascot } from "../../common/Mascot";
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
  /** e.g. "81 XP more to pass Mia" - see rank-gap.ts */
  gapLabel?: string;
  /** Scrolls the list to the student's own row. */
  onFindMe?: () => void;
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
    if (r === 1) return "Top of the board!";
    // A percentage means little on a small class board.
    if (props.total < 20) return undefined;
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
        "rounded-double bg-sub-alt px-4 py-4 font-kid",
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
            <div class="flex flex-wrap items-center gap-4">
              <Mascot mood="sleepy" size={64} />
              <div class="grid min-w-0 flex-1 gap-1">
                <div class="text-lg font-semibold text-text">
                  You&apos;re not on this board yet
                </div>
                <div class="text-sm text-sub">
                  <Switch fallback="Practice to earn your spot!">
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
              </div>
              <Show when={!props.isLbOptOut && !props.isBanned}>
                <Button
                  href="/"
                  router-link
                  chunky
                  size="lg"
                  active
                  fa={{ icon: "fa-play" }}
                  text="Start practicing"
                />
              </Show>
            </div>
          }
        >
          <div class="flex flex-wrap items-center gap-4">
            <Mascot mood={(rank() ?? 99) <= 3 ? "cheer" : "happy"} size={64} />
            <div class="min-w-0 flex-1">
              <div class="text-sm font-semibold text-sub">Your rank</div>
              <div class="flex flex-wrap items-baseline gap-2">
                <span class="rankings-heading text-3xl font-bold text-main">
                  <RankDisplay rank={rank()} />
                </span>
                <Show when={percentileLabel()}>
                  {(label) => <span class="text-sm text-sub">({label()})</span>}
                </Show>
              </div>
              <Show when={props.memoryDifference !== undefined}>
                <div class="mt-1 text-sm text-sub">
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
              <Show when={props.gapLabel}>
                {(gap) => (
                  <div class="mt-1 text-sm font-semibold text-text">
                    <Fa icon="fa-arrow-up" class="mr-1.5 text-main" />
                    {gap()}
                  </div>
                )}
              </Show>
            </div>
            <div class="grid justify-items-end gap-2">
              <Show when={statLine()}>
                {(line) => (
                  <div class="rounded-full bg-bg px-4 py-1.5 text-lg font-bold text-text">
                    {line()}
                  </div>
                )}
              </Show>
              <Show when={props.onFindMe}>
                {(onFindMe) => (
                  <Button
                    chunky
                    text="Find me"
                    fa={{ icon: "fa-search" }}
                    onClick={() => onFindMe()()}
                  />
                )}
              </Show>
            </div>
          </div>
        </Show>
      </Show>
    </div>
  );
}
