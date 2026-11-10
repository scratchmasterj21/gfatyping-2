import {
  Accessor,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  untrack,
} from "solid-js";

import { getAuthenticatedUser } from "../../../firebase";
import {
  showErrorNotification,
  showNoticeNotification,
} from "../../../states/notifications";
import {
  createScoreRace,
  finishScoreRace,
  joinScoreRace,
  kickScoreRacePlayer,
  leaveScoreRace,
  markScoreRacePlaying,
  ScoreRaceGameId,
  ScoreRacePlayer,
  ScoreRaceRoom,
  scoreRaceEndsAt,
  startScoreRace,
  subscribeScoreRace,
  updateScoreRacePlayer,
} from "../../shared/score-race";

/** Gap between live score writes (the final score is sent at once). */
const SCORE_INTERVAL_MS = 1000;
/** After time's up, wait this long for everyone's final score... */
const HOST_FINISH_GRACE_MS = 1500;
/** ...and non-hosts end the match this long after if the host hasn't. */
const NON_HOST_FINISH_GRACE_MS = 4500;

export type ScoreRacePhase = "off" | "lobby" | "playing" | "results";

export type ScoreRace = {
  gameId: ScoreRaceGameId;
  title: string;
  phase: Accessor<ScoreRacePhase>;
  room: Accessor<ScoreRaceRoom | undefined>;
  code: Accessor<string | undefined>;
  players: Accessor<ScoreRacePlayer[]>;
  isHost: Accessor<boolean>;
  busy: Accessor<boolean>;
  joinCode: Accessor<string>;
  setJoinCode: (code: string) => void;
  /** seconds left in the match (while playing) */
  secondsLeft: Accessor<number | undefined>;
  /** seconds left in the 3-2-1 */
  countdown: Accessor<number | undefined>;
  create: (input: {
    durationSec: number;
    difficultyLabel: string;
    wordListLabel: string;
    words: string[];
  }) => Promise<void>;
  join: () => Promise<void>;
  start: () => void;
  kick: (uid: string) => void;
  leave: () => Promise<void>;
  /** live score while my game runs */
  reportScore: (score: number) => void;
  /** my game is over (out of lives / my own timer ran out) */
  reportFinished: (score: number) => void;
};

/**
 * One score race session for a game modal: create/join a room, start my game
 * at the same moment as everyone else, stream my score, and end everyone's
 * game when the time runs out or all players are done.
 */
export function useScoreRace(opts: {
  gameId: ScoreRaceGameId;
  title: string;
  /** start my copy of the game with the room's words/difficulty */
  onStart: (room: ScoreRaceRoom) => void;
  /** the match is over - stop my game if it's still running */
  onEnd: () => void;
}): ScoreRace {
  const [code, setCode] = createSignal<string>();
  const [room, setRoom] = createSignal<ScoreRaceRoom>();
  const [busy, setBusy] = createSignal(false);
  const [joinCode, setJoinCode] = createSignal("");
  const [started, setStarted] = createSignal(false);
  const [ended, setEnded] = createSignal(false);
  const [now, setNow] = createSignal(Date.now());

  let unsubscribe: (() => void) | undefined;
  let startTimer: ReturnType<typeof setTimeout> | undefined;
  let scoreTimer: ReturnType<typeof setTimeout> | undefined;
  let scheduled = false;
  let finishSent = false;
  let myFinished = false;
  let wasListed = false;
  let lastSent = 0;
  let latestScore = 0;

  const uid = (): string | undefined => getAuthenticatedUser()?.uid;

  const reset = (): void => {
    unsubscribe?.();
    unsubscribe = undefined;
    clearTimeout(startTimer);
    clearTimeout(scoreTimer);
    scheduled = false;
    setEnded(false);
    finishSent = false;
    myFinished = false;
    wasListed = false;
    lastSent = 0;
    latestScore = 0;
    setStarted(false);
    setRoom(undefined);
    setCode(undefined);
  };

  const endMatch = (): void => {
    if (untrack(ended)) return;
    setEnded(true);
    clearTimeout(scoreTimer);
    opts.onEnd();
  };

  const watch = (roomCode: string): void => {
    reset();
    setCode(roomCode);
    unsubscribe = subscribeScoreRace(roomCode, (next) => {
      if (next === null) {
        if (!untrack(started)) {
          showNoticeNotification(`The ${opts.title} room was closed`);
        }
        endMatch();
        reset();
        return;
      }
      const me = uid();
      const listed = me !== undefined && next.players?.[me] !== undefined;
      if (listed) {
        wasListed = true;
      } else if (wasListed && next.status === "lobby") {
        showNoticeNotification("The host took you out of the room.");
        reset();
        return;
      }
      setRoom(next);
      if (
        next.startAt !== undefined &&
        !scheduled &&
        next.status !== "finished"
      ) {
        scheduled = true;
        const startAt = next.startAt;
        startTimer = setTimeout(
          () => {
            const current = untrack(room) ?? next;
            if (current.status === "finished") return;
            setStarted(true);
            if (current.hostUid === uid()) {
              void markScoreRacePlaying(roomCode).catch(() => undefined);
            }
            opts.onStart(current);
          },
          Math.max(0, startAt - Date.now()),
        );
      }
      if (next.status === "finished") endMatch();
    });
  };

  // clock for the countdown and time left
  createEffect(() => {
    if (code() === undefined) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    onCleanup(() => clearInterval(timer));
  });

  const isHost = createMemo(() => {
    const r = room();
    return r !== undefined && r.hostUid === uid();
  });

  // end the match when time's up (the host, or anyone if the host is gone)
  createEffect(() => {
    const r = room();
    if (r === undefined || r.status === "finished" || finishSent) return;
    const endsAt = scoreRaceEndsAt(r);
    if (endsAt === undefined) return;
    const t = now();
    if (t >= endsAt && untrack(started) && !untrack(ended)) {
      // time's up: stop my game and send my final score right away
      endMatch();
      if (!myFinished) {
        myFinished = true;
        send(latestScore, true);
      }
    }
    if (
      t >=
      endsAt + (isHost() ? HOST_FINISH_GRACE_MS : NON_HOST_FINISH_GRACE_MS)
    ) {
      finishSent = true;
      void finishScoreRace(r.code).catch(() => {
        finishSent = false;
      });
    }
  });

  // host: end early once everyone still online is done
  createEffect(() => {
    const r = room();
    if (r?.status !== "playing" || !isHost() || finishSent) return;
    const online = Object.values(r.players ?? {}).filter((p) => p.online);
    if (online.length > 0 && online.every((p) => p.finished)) {
      finishSent = true;
      void finishScoreRace(r.code).catch(() => {
        finishSent = false;
      });
    }
  });

  const phase = createMemo((): ScoreRacePhase => {
    if (code() === undefined) return "off";
    const r = room();
    if (r?.status === "finished" || ended()) return "results";
    if (started()) return "playing";
    return "lobby";
  });

  const players = createMemo(() =>
    Object.values(room()?.players ?? {}).sort(
      (a, b) => b.score - a.score || a.name.localeCompare(b.name),
    ),
  );

  const secondsLeft = createMemo(() => {
    const r = room();
    const endsAt = r === undefined ? undefined : scoreRaceEndsAt(r);
    if (endsAt === undefined || !started()) return undefined;
    return Math.max(0, Math.ceil((endsAt - now()) / 1000));
  });

  const countdown = createMemo(() => {
    const r = room();
    if (r?.status !== "countdown" || r.startAt === undefined || started()) {
      return undefined;
    }
    return Math.max(1, Math.ceil((r.startAt - now()) / 1000));
  });

  const send = (score: number, finished: boolean): void => {
    const roomCode = code();
    if (roomCode === undefined) return;
    lastSent = Date.now();
    void updateScoreRacePlayer(roomCode, { score, finished }).catch(
      () => undefined,
    );
  };

  const leave = async (): Promise<void> => {
    const roomCode = code();
    reset();
    if (roomCode !== undefined) {
      await leaveScoreRace(roomCode).catch(() => undefined);
    }
  };

  onCleanup(() => void leave());

  return {
    gameId: opts.gameId,
    title: opts.title,
    phase,
    room,
    code,
    players,
    isHost,
    busy,
    joinCode,
    setJoinCode,
    secondsLeft,
    countdown,
    create: async (input) => {
      setBusy(true);
      try {
        watch(await createScoreRace({ gameId: opts.gameId, ...input }));
      } catch (error) {
        showErrorNotification(`Could not create ${opts.title} room`, {
          error,
        });
      } finally {
        setBusy(false);
      }
    },
    join: async () => {
      if (!/^\d{6}$/.test(joinCode())) {
        showErrorNotification("Enter the 6-digit room code");
        return;
      }
      setBusy(true);
      try {
        watch(await joinScoreRace(joinCode(), opts.gameId));
      } catch (error) {
        showErrorNotification(`Could not join ${opts.title} room`, { error });
      } finally {
        setBusy(false);
      }
    },
    start: () => {
      const roomCode = code();
      if (roomCode === undefined) return;
      startScoreRace(roomCode).catch((error: unknown) =>
        showErrorNotification("Could not start the match", { error }),
      );
    },
    kick: (playerUid) => {
      const roomCode = code();
      if (roomCode === undefined) return;
      kickScoreRacePlayer(roomCode, playerUid).catch((error: unknown) =>
        showErrorNotification("Could not remove player", { error }),
      );
    },
    leave,
    reportScore: (score) => {
      latestScore = score;
      if (myFinished || untrack(ended)) return;
      clearTimeout(scoreTimer);
      const wait = SCORE_INTERVAL_MS - (Date.now() - lastSent);
      if (wait <= 0) send(score, false);
      else scoreTimer = setTimeout(() => send(score, false), wait);
    },
    reportFinished: (score) => {
      latestScore = score;
      if (myFinished) return;
      myFinished = true;
      clearTimeout(scoreTimer);
      send(score, true);
    },
  };
}
