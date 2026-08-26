import {
  createEffect,
  createMemo,
  createSignal,
  JSXElement,
  onCleanup,
} from "solid-js";

import { LeaderboardType } from "../../../states/leaderboard-selection";
import { cn } from "../../../utils/cn";
import { secondsToString } from "../../../utils/date-and-time";

export function NextUpdate(props: {
  type: LeaderboardType;
  class?: string;
}): JSXElement {
  const [tick, setTick] = createSignal(Date.now());

  // Update the tick every second
  createEffect(() => {
    const interval = setInterval(() => setTick(Date.now()), 1000);
    onCleanup(() => clearInterval(interval));
  });

  const nextUpdate = createMemo(() => {
    const now = tick();
    if (props.type === "daily") {
      const japanNow = new Date(now + 9 * 60 * 60 * 1000);
      const nextJapanMidnight =
        Date.UTC(
          japanNow.getUTCFullYear(),
          japanNow.getUTCMonth(),
          japanNow.getUTCDate() + 1,
        ) -
        9 * 60 * 60 * 1000;
      const diff = Math.max(0, Math.floor((nextJapanMidnight - now) / 1000));
      return `Next reset in: ${secondsToString(diff, true)}`;
    } else if (props.type === "allTime") {
      const date = new Date(now);
      const minutesToNextUpdate = 14 - (date.getMinutes() % 15);
      const secondsToNextUpdate = 60 - date.getSeconds();
      const totalSeconds = minutesToNextUpdate * 60 + secondsToNextUpdate;
      return `Next update in: ${secondsToString(totalSeconds, true)}`;
    } else if (props.type === "weekly") {
      const japanNow = new Date(now + 9 * 60 * 60 * 1000);
      const daysUntilMonday = (8 - japanNow.getUTCDay()) % 7 || 7;
      const nextWeekTimestamp =
        Date.UTC(
          japanNow.getUTCFullYear(),
          japanNow.getUTCMonth(),
          japanNow.getUTCDate() + daysUntilMonday,
        ) -
        9 * 60 * 60 * 1000;
      const totalSeconds = Math.max(
        0,
        Math.floor((nextWeekTimestamp - now) / 1000),
      );
      return `Next reset in: ${secondsToString(
        totalSeconds,
        true,
        true,
        ":",
        true,
        true,
      )}`;
    }
    return "";
  });

  return <div class={cn(`text-sub`, props.class)}>{nextUpdate()}</div>;
}
