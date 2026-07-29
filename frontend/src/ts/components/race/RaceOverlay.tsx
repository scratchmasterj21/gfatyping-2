import {
  createMemo,
  createSignal,
  For,
  JSXElement,
  onCleanup,
  onMount,
  Show,
} from "solid-js";

import { getAuthenticatedUser } from "../../firebase";
import { raceCoinsEarned } from "../../race/race-db";
import { exitRace, tryReconnectRace } from "../../race/race-runner";
import {
  getCurrentRace,
  getRaceParticipants,
  getRaceRole,
} from "../../race/race-state";
import { rankParticipants, RaceParticipant } from "../../race/race-types";
import { cn } from "../../utils/cn";
import { Fa } from "../common/Fa";

function Avatar(props: { url?: string }): JSXElement {
  return (
    <Show
      when={props.url !== undefined && props.url !== ""}
      fallback={
        <div class="flex aspect-square w-7 shrink-0 items-center justify-center rounded-full bg-bg text-sub">
          <Fa icon="fa-user" />
        </div>
      }
    >
      <img
        src={props.url}
        alt=""
        class="aspect-square w-7 shrink-0 rounded-full object-cover"
      />
    </Show>
  );
}

function medal(rank: number): string {
  if (rank === 1) return "text-main";
  if (rank === 2) return "text-text";
  if (rank === 3) return "text-sub";
  return "text-sub";
}

export function RaceOverlay(): JSXElement {
  const [now, setNow] = createSignal(Date.now());
  const timer = setInterval(() => setNow(Date.now()), 200);
  onCleanup(() => clearInterval(timer));

  // Attempt to reconnect if the page was reloaded mid-race.
  onMount(() => {
    void tryReconnectRace();
  });

  const selfUid = (): string | undefined => getAuthenticatedUser()?.uid;
  const isParticipant = (): boolean => getRaceRole() === "participant";
  const status = (): string | undefined => getCurrentRace()?.status;

  const countdownLeft = createMemo((): number => {
    const race = getCurrentRace();
    if (race?.startAt === undefined) return 0;
    return Math.max(0, Math.ceil((race.startAt - now()) / 1000));
  });

  /** Seconds remaining in a timed race, derived from runningAt. */
  const timedLeft = createMemo((): number => {
    const race = getCurrentRace();
    if (
      race?.format !== "timed" ||
      race.runningAt === undefined ||
      race.durationSec === undefined
    ) {
      return 0;
    }
    return Math.max(
      0,
      Math.ceil((race.runningAt + race.durationSec * 1000 - now()) / 1000),
    );
  });

  /** For timed races: bar is WPM relative to the fastest participant. */
  const maxWpm = (): number =>
    Math.max(
      1,
      ...getRaceParticipants().map((p) =>
        p.finished ? (p.finalWpm ?? 0) : (p.liveWpm ?? 0),
      ),
    );

  const barPct = (p: RaceParticipant): number => {
    const race = getCurrentRace();
    if (race?.format === "timed") {
      const wpm = p.finished ? (p.finalWpm ?? 0) : (p.liveWpm ?? 0);
      return Math.min(100, (wpm / maxWpm()) * 100);
    }
    return Math.min(100, p.progress * 100);
  };

  const wpmLabel = (p: RaceParticipant): string => {
    if (p.finished) return `${Math.round(p.finalWpm ?? 0)} wpm`;
    if (p.liveWpm !== undefined) return `${p.liveWpm} wpm`;
    return "";
  };

  const liveSorted = createMemo((): RaceParticipant[] => {
    const race = getCurrentRace();
    const fmt = race?.format ?? "finish";
    return [...getRaceParticipants()].sort((a, b) =>
      fmt === "timed"
        ? (b.liveWpm ?? 0) - (a.liveWpm ?? 0)
        : b.progress - a.progress,
    );
  });

  const standings = createMemo(() =>
    rankParticipants(
      getRaceParticipants(),
      getCurrentRace()?.format ?? "finish",
    ),
  );

  const showCountdown = (): boolean =>
    isParticipant() && status() === "countdown" && countdownLeft() > 0;
  const showLive = (): boolean =>
    isParticipant() &&
    (status() === "running" ||
      (status() === "countdown" && countdownLeft() === 0));
  const showResults = (): boolean => isParticipant() && status() === "finished";

  return (
    <Show when={isParticipant()}>
      {/* Countdown: covers the screen so nobody starts early. */}
      <Show when={showCountdown()}>
        <div class="fixed inset-0 z-60 flex flex-col items-center justify-center gap-4 bg-bg/95">
          <div class="tracking-widest text-sub uppercase">get ready</div>
          <div class="text-[8em] leading-none font-bold text-main">
            {countdownLeft()}
          </div>
          <div class="text-sub">{getCurrentRace()?.contentLabel}</div>
        </div>
      </Show>

      {/* Live progress bars: top of the screen, non-blocking. */}
      <Show when={showLive()}>
        <div class="pointer-events-none fixed inset-x-0 top-2 z-60 flex justify-center">
          <div class="pointer-events-auto grid w-full max-w-xl gap-1 rounded bg-sub-alt/95 p-3 shadow">
            <div class="mb-1 flex items-center justify-between gap-2 text-em-xs text-sub">
              <span class="flex items-center gap-2">
                <Fa icon="fa-flag-checkered" />
                live race
              </span>
              <Show
                when={getCurrentRace()?.format === "timed" && timedLeft() > 0}
              >
                <span class="font-bold text-main">{timedLeft()}s</span>
              </Show>
            </div>
            <For each={liveSorted()}>
              {(p) => (
                <div class="flex items-center gap-2">
                  <Avatar url={p.avatarUrl} />
                  <div class="min-w-0 flex-1">
                    <div
                      class={cn("mb-0.5 truncate text-em-xs", {
                        "text-main": p.uid === selfUid(),
                        "text-sub": p.uid !== selfUid(),
                      })}
                    >
                      {p.name}
                      {p.uid === selfUid() ? " (you)" : ""}
                      {p.finished ? " ✓" : ""}
                    </div>
                    <div class="h-2 w-full overflow-hidden rounded bg-bg">
                      <div
                        class="h-full rounded bg-main transition-[width] duration-200"
                        style={{ width: `${barPct(p)}%` }}
                      ></div>
                    </div>
                  </div>
                  <span class="w-14 shrink-0 text-right text-em-xs text-sub">
                    {wpmLabel(p)}
                  </span>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Final standings modal. */}
      <Show when={showResults()}>
        <div class="fixed inset-0 z-60 flex items-center justify-center bg-bg/80 p-4">
          <div class="grid w-full max-w-md gap-3 rounded bg-sub-alt p-6">
            <div class="flex items-center gap-2 text-[1.5em] text-main">
              <Fa icon="fa-trophy" />
              results
            </div>
            <div class="grid gap-1">
              <For each={standings()}>
                {(s) => (
                  <div
                    class={cn(
                      "flex items-center gap-3 rounded p-2",
                      s.uid === selfUid() ? "bg-bg" : "",
                    )}
                  >
                    <span
                      class={cn("w-6 text-center font-bold", medal(s.rank))}
                    >
                      {s.rank}
                    </span>
                    <Avatar url={s.avatarUrl} />
                    <span class="min-w-0 flex-1 truncate text-text">
                      {s.name}
                      {s.uid === selfUid() ? " (you)" : ""}
                    </span>
                    <span class="text-text">
                      {getCurrentRace()?.format === "accuracy"
                        ? `${Math.round(s.finalAcc)}%`
                        : `${Math.round(s.finalWpm)} wpm`}
                    </span>
                    <span class="text-em-xs text-sub">
                      {getCurrentRace()?.format === "accuracy"
                        ? `${Math.round(s.finalWpm)} wpm`
                        : `${Math.round(s.finalAcc)}%`}
                    </span>
                    <Show when={raceCoinsEarned(s) > 0}>
                      <span class="flex items-center gap-1 text-em-xs text-main">
                        <Fa icon="fa-coins" size={0.7} />+{raceCoinsEarned(s)}
                      </span>
                    </Show>
                  </div>
                )}
              </For>
            </div>
            <button
              type="button"
              class="mt-2 cursor-pointer rounded bg-bg p-2 text-text hover:bg-text hover:text-bg"
              onClick={() => void exitRace()}
            >
              leave race
            </button>
          </div>
        </div>
      </Show>
    </Show>
  );
}
