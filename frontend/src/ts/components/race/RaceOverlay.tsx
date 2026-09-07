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
import { rankParticipants } from "../../race/race-types";
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

      {/* Compact status only: the full roster obscured the typing area and
          required every student to listen to every live progress update. */}
      <Show when={showLive()}>
        <div class="pointer-events-none fixed inset-x-0 top-2 z-60 flex justify-end px-2">
          <div class="flex items-center gap-2 rounded bg-sub-alt/95 px-3 py-2 text-em-xs text-sub shadow">
            <Fa icon="fa-flag-checkered" />
            <span>live race</span>
            <Show
              when={getCurrentRace()?.format === "timed" && timedLeft() > 0}
            >
              <span class="font-bold text-main">{timedLeft()}s</span>
            </Show>
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
