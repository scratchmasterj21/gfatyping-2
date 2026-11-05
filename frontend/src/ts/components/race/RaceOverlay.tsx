import {
  createEffect,
  createMemo,
  createSignal,
  For,
  JSXElement,
  onCleanup,
  onMount,
  Show,
} from "solid-js";

import { getAuthenticatedUser } from "../../firebase";
import { BLITZ_POINTS, BlitzState } from "../../race/blitz";
import {
  standingCoins,
  standingTotals,
  submitBlitzAnswer,
  subscribeBlitzState,
  subscribeTugTotals,
  withTeams,
} from "../../race/race-db";
import { exitRace, tryReconnectRace } from "../../race/race-runner";
import {
  getCurrentRace,
  getRaceParticipants,
  getRaceRole,
} from "../../race/race-state";
import {
  isTimedFormat,
  RaceStanding,
  rankParticipants,
  TugTeam,
} from "../../race/race-types";
import { TugTotals, tugOutcome } from "../../race/tug";
import { getSnapshot } from "../../states/snapshot";
import { cn } from "../../utils/cn";
import { Fa } from "../common/Fa";
import { Mascot } from "../common/Mascot";

const TEAM_LABEL: Record<TugTeam, string> = {
  red: "🔴 Red team",
  blue: "🔵 Blue team",
};
const TEAM_BG: Record<TugTeam, string> = {
  red: "bg-game-red",
  blue: "bg-game-blue",
};

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
      !isTimedFormat(race?.format) ||
      race?.runningAt === undefined ||
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
    withTeams(
      rankParticipants(
        getRaceParticipants(),
        getCurrentRace()?.format ?? "finish",
      ),
      getCurrentRace()?.teams,
    ),
  );
  const coinsFor = (s: RaceStanding): number =>
    standingCoins(s, getCurrentRace()?.format, standings());

  // ---- Tug of War ----
  const isTug = (): boolean => getCurrentRace()?.format === "tug";
  const myTeam = (): TugTeam | undefined => {
    const uid = selfUid();
    return uid === undefined ? undefined : getCurrentRace()?.teams?.[uid];
  };
  const [tugLive, setTugLive] = createSignal<TugTotals | null>(null);
  // Only the tiny totals node - never every classmate's progress.
  createEffect(() => {
    const race = getCurrentRace();
    if (
      !isParticipant() ||
      race?.format !== "tug" ||
      race.status !== "running"
    ) {
      return;
    }
    const unsub = subscribeTugTotals(race.pin, setTugLive);
    onCleanup(() => {
      unsub();
      setTugLive(null);
    });
  });
  const tugFinal = createMemo(() => standingTotals(standings()));

  // ---- Word Blitz ----
  const isBlitz = (): boolean => getCurrentRace()?.format === "blitz";
  const [blitz, setBlitz] = createSignal<BlitzState | null>(null);
  const [typed, setTyped] = createSignal("");
  const [answeredRound, setAnsweredRound] = createSignal(0);
  const [myPoints, setMyPoints] = createSignal(0);
  const counted = new Set<number>();
  let blitzInput: HTMLInputElement | undefined;
  createEffect(() => {
    const race = getCurrentRace();
    if (
      !isParticipant() ||
      race?.format !== "blitz" ||
      (race.status !== "running" && race.status !== "countdown")
    ) {
      return;
    }
    const unsub = subscribeBlitzState(race.pin, setBlitz);
    onCleanup(() => {
      unsub();
      setBlitz(null);
    });
  });
  // new word: clear the box and focus it; on reveal, add this round's points
  createEffect(() => {
    const st = blitz();
    if (st === null) return;
    if (st.phase === "live") {
      setTyped("");
      setTimeout(() => blitzInput?.focus(), 0);
    } else if (!counted.has(st.round)) {
      counted.add(st.round);
      if (st.winnerUid !== undefined && st.winnerUid === selfUid()) {
        setMyPoints((p) => p + BLITZ_POINTS.fastest);
      } else if (answeredRound() === st.round) {
        setMyPoints((p) => p + BLITZ_POINTS.correct);
      }
    }
  });
  const onBlitzInput = (value: string): void => {
    const st = blitz();
    const race = getCurrentRace();
    setTyped(value);
    if (
      st === null ||
      race === null ||
      st.phase !== "live" ||
      answeredRound() === st.round ||
      value.trim() !== st.word
    ) {
      return;
    }
    setAnsweredRound(st.round);
    void submitBlitzAnswer(
      race.pin,
      st.round,
      st.word,
      getSnapshot()?.name ?? "Student",
    );
  };
  const blitzWrong = (): boolean => {
    const st = blitz();
    return st !== null && !st.word.startsWith(typed().trim());
  };
  const showBlitz = (): boolean =>
    isParticipant() &&
    isBlitz() &&
    (status() === "running" ||
      (status() === "countdown" && countdownLeft() === 0));

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
        <div class="fixed inset-0 z-60 flex flex-col items-center justify-center gap-4 bg-bg/95 font-kid">
          <Show when={isTug() && myTeam()}>
            {(team) => (
              <div
                class={cn(
                  "animate-game-pop rounded-full px-6 py-2 text-3xl font-bold text-game-cream motion-reduce:animate-none",
                  TEAM_BG[team()],
                )}
              >
                You&apos;re on the {TEAM_LABEL[team()]}!
              </div>
            )}
          </Show>
          <div class="text-xl font-bold text-sub">Get ready…</div>
          <div class="text-[8em] leading-none font-bold text-main">
            {countdownLeft()}
          </div>
          <div class="text-sub">{getCurrentRace()?.contentLabel}</div>
        </div>
      </Show>

      {/* Compact status only: the full roster obscured the typing area and
          required every student to listen to every live progress update. */}
      <Show when={showLive() && !isBlitz()}>
        <div class="pointer-events-none fixed inset-x-0 top-2 z-60 flex justify-end px-2">
          <Show when={isTug() && myTeam()}>
            {(team) => (
              <div class="mr-2 flex items-center gap-2 rounded-full bg-sub-alt/95 px-3 py-1.5 font-kid text-sm font-bold shadow">
                <span class="text-game-red">🔴 {tugLive()?.red ?? 0}</span>
                <span class="relative h-2 w-28 rounded-full bg-game-tan">
                  <span
                    class="absolute top-1/2 h-4 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-game-ink transition-[left] duration-700"
                    style={{
                      left: `${50 + Math.max(-45, Math.min(45, ((tugLive()?.blue ?? 0) - (tugLive()?.red ?? 0)) * 2))}%`,
                    }}
                  ></span>
                </span>
                <span class="text-game-blue">{tugLive()?.blue ?? 0} 🔵</span>
                <span class="text-text">
                  Pull for {team() === "red" ? "Red" : "Blue"}!
                </span>
              </div>
            )}
          </Show>
          <div class="flex items-center gap-2 rounded bg-sub-alt/95 px-3 py-2 text-em-xs text-sub shadow">
            <Fa icon="fa-flag-checkered" />
            <span>{isTug() ? "tug of war" : "live race"}</span>
            <Show
              when={isTimedFormat(getCurrentRace()?.format) && timedLeft() > 0}
            >
              <span class="font-bold text-main">{timedLeft()}s</span>
            </Show>
          </div>
        </div>
      </Show>

      {/* Word Blitz: full-screen quiz for students. */}
      <Show when={showBlitz()}>
        <div class="fixed inset-0 z-60 flex flex-col items-center justify-center gap-5 bg-bg/97 p-4 text-center font-kid">
          <div class="flex items-center gap-3 text-lg font-bold">
            <span class="rounded-full bg-game-purple px-4 py-1 text-game-cream">
              ⚡ Word Blitz
            </span>
            <span class="rounded-full bg-game-gold px-4 py-1 text-game-ink">
              My points: {myPoints()}
            </span>
          </div>
          <Show
            when={blitz()}
            fallback={
              <div class="text-2xl font-bold text-sub">
                Get ready for the first word…
              </div>
            }
          >
            {(st) => (
              <Show
                when={st().phase === "live"}
                fallback={
                  <div class="grid animate-game-pop gap-2 motion-reduce:animate-none">
                    <div class="text-4xl font-bold text-text">
                      {st().winnerUid === selfUid()
                        ? `⚡ You were fastest! +${BLITZ_POINTS.fastest}`
                        : answeredRound() === st().round
                          ? `✅ Correct! +${BLITZ_POINTS.correct}`
                          : "⏰ Too slow - next word coming!"}
                    </div>
                    <Show
                      when={
                        st().winnerName !== undefined &&
                        st().winnerUid !== selfUid()
                      }
                    >
                      <div class="text-lg text-sub">
                        Fastest: {st().winnerName}
                      </div>
                    </Show>
                  </div>
                }
              >
                <div class="text-lg font-bold text-sub">Word {st().round}</div>
                <div class="font-mono text-6xl font-bold tracking-wide text-main sm:text-7xl">
                  {st().word}
                </div>
                <Show
                  when={answeredRound() !== st().round}
                  fallback={
                    <div class="animate-game-pop text-3xl font-bold text-game-green motion-reduce:animate-none">
                      ✅ Got it! Waiting for the others…
                    </div>
                  }
                >
                  <input
                    ref={(el) => {
                      blitzInput = el;
                    }}
                    type="text"
                    value={typed()}
                    placeholder="type it here"
                    aria-label={`Type ${st().word}`}
                    autocomplete="off"
                    autocapitalize="off"
                    spellcheck={false}
                    class={cn(
                      "w-full max-w-md rounded-double border-4 bg-game-cream px-5 py-3 text-center font-mono text-3xl font-bold text-game-ink outline-none placeholder:text-game-ink/35",
                      blitzWrong()
                        ? "animate-game-shake border-game-red motion-reduce:animate-none"
                        : "border-game-ink/15 focus:border-game-blue",
                    )}
                    onInput={(e) => onBlitzInput(e.currentTarget.value)}
                  />
                </Show>
              </Show>
            )}
          </Show>
        </div>
      </Show>

      {/* Final standings modal. */}
      <Show when={showResults()}>
        <div class="fixed inset-0 z-60 flex items-center justify-center bg-bg/80 p-4">
          <div class="grid w-full max-w-md gap-3 rounded-double bg-sub-alt p-6 font-kid">
            <div class="flex items-center gap-3">
              <Mascot mood="cheer" size={64} />
              <div class="text-2xl font-bold text-main">Race results</div>
            </div>
            <Show when={isTug()}>
              <div
                class={cn(
                  "rounded-full px-4 py-1.5 text-center text-xl font-bold text-game-cream",
                  tugOutcome(tugFinal()) === "draw"
                    ? "bg-game-purple"
                    : TEAM_BG[tugOutcome(tugFinal()) as TugTeam],
                )}
              >
                {tugOutcome(tugFinal()) === "draw"
                  ? "🤝 It's a draw!"
                  : `${TEAM_LABEL[tugOutcome(tugFinal()) as TugTeam]} wins! ${tugFinal().red} - ${tugFinal().blue}`}
              </div>
            </Show>
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
                      {s.team === "red"
                        ? "🔴 "
                        : s.team === "blue"
                          ? "🔵 "
                          : ""}
                      {s.name}
                      {s.uid === selfUid() ? " (you)" : ""}
                    </span>
                    <span class="text-text">
                      {isBlitz()
                        ? `${s.words ?? 0} points`
                        : isTug()
                          ? `${s.words ?? 0} words`
                          : getCurrentRace()?.format === "accuracy"
                            ? `${Math.round(s.finalAcc)}%`
                            : `${Math.round(s.finalWpm)} wpm`}
                    </span>
                    <Show when={!isBlitz() && !isTug()}>
                      <span class="text-em-xs text-sub">
                        {getCurrentRace()?.format === "accuracy"
                          ? `${Math.round(s.finalWpm)} wpm`
                          : `${Math.round(s.finalAcc)}%`}
                      </span>
                    </Show>
                    <Show when={coinsFor(s) > 0}>
                      <span class="flex items-center gap-1 rounded-full bg-game-gold px-2 py-0.5 text-xs font-bold text-game-ink">
                        <Fa icon="fa-coins" />+{coinsFor(s)}
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
