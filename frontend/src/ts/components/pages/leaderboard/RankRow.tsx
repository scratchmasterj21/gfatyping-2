import {
  LeaderboardEntry,
  XpLeaderboardEntry,
} from "@monkeytype/schemas/leaderboards";
import { JSXElement, Show } from "solid-js";

import type { TableEntry } from "./table-entry";

import { RaceLeaderboardEntry } from "../../../classroom/classroom";
import { hasConnection } from "../../../collections/connections";
import { getFormatting, getUserId } from "../../../states/core";
import { cn } from "../../../utils/cn";
import { secondsToString } from "../../../utils/date-and-time";
import { abbreviateNumber } from "../../../utils/numbers";
import { TitleBadge } from "../../common/TitleBadge";
import { User } from "../../common/User";
import { RankDisplay } from "./RankDisplay";

export type RankRowVariant =
  | { kind: "lessonStars"; name: string; uid: string; lessonStars: number }
  | { kind: "gameScore"; name: string; uid: string; score: number }
  | {
      kind: "entry";
      type: "speed" | "xp" | "racewpm" | "raceacc" | "racestat";
      entry: TableEntry;
      friendsOnly: boolean;
      compactXp?: boolean;
    };

export type RankRowStats = { primary: string; secondary?: string };

/** Primary (big) and secondary (small) stat text for a ranking row. */
export function rankRowStats(v: RankRowVariant): RankRowStats {
  const format = getFormatting();
  if (v.kind === "lessonStars") {
    return { primary: `${v.lessonStars} ★` };
  }
  if (v.kind === "gameScore") {
    return { primary: String(v.score) };
  }
  const entry = v.entry;
  if (v.type === "speed") {
    const e = entry as LeaderboardEntry;
    return {
      primary: format.typingSpeed(e.wpm, { showDecimalPlaces: true }),
      secondary: format.percentage(e.acc, { showDecimalPlaces: true }),
    };
  }
  if (v.type === "xp") {
    const e = entry as XpLeaderboardEntry;
    const xp =
      e.totalXp < 1000 ? e.totalXp.toFixed(0) : abbreviateNumber(e.totalXp);
    if (v.compactXp === true) {
      return { primary: `${xp} XP` };
    }
    return {
      primary: `${xp} XP`,
      secondary: secondsToString(
        Math.round(e.timeTypedSeconds),
        true,
        true,
        ":",
      ),
    };
  }
  const e = entry as RaceLeaderboardEntry;
  if (v.type === "racestat") {
    return {
      primary: `${e.stat ?? 0} ${e.statLabel ?? ""}`.trim(),
      secondary:
        e.statLabel === "races" ? `${e.wins} wins` : `${e.totalRaces} races`,
    };
  }
  if (v.type === "raceacc") {
    return {
      primary: `${Math.round(e.bestRaceAcc)}%`,
      secondary: `${Math.round(e.bestRaceWpm)} WPM`,
    };
  }
  return {
    primary: `${Math.round(e.bestRaceWpm)} WPM`,
    secondary: `${Math.round(e.bestRaceAcc)}%`,
  };
}

export function RankRow(props: {
  rank: number;
  variant: RankRowVariant;
  selfUid?: string;
  highlightColor?: string;
  class?: string;
  dataRankUser?: boolean;
  /** Overrides the entry's own title (e.g. from an already-loaded avatar). */
  titleId?: string;
}): JSXElement {
  const titleId = (): string | undefined => {
    if (props.titleId !== undefined) return props.titleId;
    if (props.variant.kind !== "entry") return undefined;
    const entry = props.variant.entry as { title?: unknown };
    return typeof entry.title === "string" ? entry.title : undefined;
  };
  const isSelf = (): boolean => {
    const uid =
      props.variant.kind === "entry"
        ? props.variant.entry.uid
        : props.variant.uid;
    return (
      uid === props.selfUid ||
      uid === getUserId() ||
      (props.dataRankUser === true && uid === getUserId())
    );
  };

  const stats = () => rankRowStats(props.variant);

  return (
    <div
      class={cn(
        "flex min-h-14 min-w-0 items-center gap-3 rounded-xl px-4 py-2.5 font-kid",
        isSelf()
          ? "rank-row-self bg-main/15 outline-2 outline-main"
          : "bg-sub-alt/60",
        props.class,
      )}
      data-rank-user={isSelf() ? "" : undefined}
      style={
        props.highlightColor === undefined
          ? undefined
          : {
              "border-left": `3px solid ${props.highlightColor}`,
              "background-color": `${props.highlightColor}22`,
            }
      }
    >
      <span class="w-9 shrink-0 text-center text-lg font-bold text-sub">
        <RankDisplay rank={props.rank} />
      </span>
      <Show
        when={props.variant.kind === "entry" ? props.variant : false}
        fallback={
          <span class="min-w-0 flex-1 truncate text-text">
            {props.variant.kind === "lessonStars" ||
            props.variant.kind === "gameScore"
              ? props.variant.name
              : ""}
            {isSelf() ? " (you)" : ""}
          </span>
        }
      >
        {(variant) => (
          <User
            avatarFallback="user-circle"
            avatarColor="sub"
            flagsColor="sub"
            user={variant().entry}
            isFriend={hasConnection(variant().entry.uid, "accepted")}
            truncateName={true}
            class="min-w-0 flex-1 text-[1em] **:data-[ui-element='button']:[--themable-button-text:var(--text-color)]"
            linkToProfile={true}
          />
        )}
      </Show>
      <TitleBadge titleId={titleId()} class="hidden sm:inline-flex" />
      <div class="shrink-0 text-right">
        <div class="text-lg font-bold text-text">{stats().primary}</div>
        <Show when={stats().secondary !== undefined}>
          <div class="text-sm text-sub">{stats().secondary}</div>
        </Show>
      </div>
    </div>
  );
}
