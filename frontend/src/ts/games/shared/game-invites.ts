import { onDisconnect, onValue, ref, remove, set } from "firebase/database";

import { gradeOf } from "../../constants/classes";
import {
  getAuthenticatedUser,
  getRealtimeDb,
  trackRealtimeListener,
} from "../../firebase";
import { getSnapshot } from "../../states/snapshot";

/**
 * Invites for student-hosted games (RTDB gameInvites/{grade}/{gameId}).
 * A student who taps "Wait for an invite" puts themselves on their grade's
 * waiting list for that game - only while that screen is open, so idle
 * students hold no connection (Spark plan connection limit). A host in the
 * lobby sees the list and writes an invite (the room code) onto a student's
 * entry; the student taps Join.
 */

export type GameInvite = {
  code: string;
  fromUid: string;
  fromName: string;
  at: number;
};

export type WaitingClassmate = {
  uid: string;
  name: string;
  classId: string;
  at: number;
  invite?: GameInvite;
};

/** Invites older than this are ignored (the room has likely moved on). */
export const INVITE_TTL_MS = 2 * 60_000;

/** My grade ("G3") from my class, or undefined if no class is set. */
export function myGrade(): string | undefined {
  const classId = getSnapshot()?.classId;
  const grade = classId === undefined ? undefined : gradeOf(classId);
  return grade !== undefined && /^G[1-6]$/.test(grade) ? grade : undefined;
}

function myName(): string {
  const name = getSnapshot()?.name ?? getAuthenticatedUser()?.displayName;
  return (name ?? "Student").slice(0, 40);
}

const listPath = (grade: string, gameId: string, uid = ""): string =>
  `gameInvites/${grade}/${gameId}/waiting${uid === "" ? "" : `/${uid}`}`;

export function isFreshInvite(
  invite: GameInvite | undefined,
  now = Date.now(),
): invite is GameInvite {
  return invite !== undefined && now - invite.at < INVITE_TTL_MS;
}

/**
 * Put me on the waiting list and call `onInvite` whenever my invite changes.
 * Returns a stop function that takes me off the list.
 */
export function waitForInvite(
  gameId: string,
  onInvite: (invite: GameInvite | null) => void,
): () => void {
  const user = getAuthenticatedUser();
  const grade = myGrade();
  const classId = getSnapshot()?.classId;
  if (user === null || grade === undefined || classId === undefined) {
    return () => undefined;
  }
  const mine = ref(getRealtimeDb(), listPath(grade, gameId, user.uid));
  let stopped = false;
  void (async () => {
    await onDisconnect(mine).remove();
    if (stopped) return;
    await set(mine, {
      uid: user.uid,
      name: myName(),
      classId,
      at: Date.now(),
    } satisfies WaitingClassmate);
  })().catch(() => undefined);
  const unsubscribe = trackRealtimeListener(
    onValue(
      ref(getRealtimeDb(), `${listPath(grade, gameId, user.uid)}/invite`),
      (snap) => onInvite(snap.exists() ? (snap.val() as GameInvite) : null),
    ),
  );
  return () => {
    stopped = true;
    unsubscribe();
    void remove(mine).catch(() => undefined);
    void onDisconnect(mine)
      .cancel()
      .catch(() => undefined);
  };
}

/** Say no to an invite (stay on the list so someone else can invite me). */
export async function declineInvite(gameId: string): Promise<void> {
  const user = getAuthenticatedUser();
  const grade = myGrade();
  if (user === null || grade === undefined) return;
  await remove(
    ref(getRealtimeDb(), `${listPath(grade, gameId, user.uid)}/invite`),
  );
}

/** Host: watch my grade's waiting list for this game. */
export function watchWaitingClassmates(
  gameId: string,
  callback: (waiting: WaitingClassmate[]) => void,
): () => void {
  const grade = myGrade();
  if (grade === undefined) return () => undefined;
  return trackRealtimeListener(
    onValue(
      ref(getRealtimeDb(), listPath(grade, gameId)),
      (snap) => {
        const value = (snap.val() ?? {}) as Record<string, WaitingClassmate>;
        callback(
          Object.values(value)
            .filter((w) => typeof w.uid === "string")
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
      },
      () => callback([]),
    ),
  );
}

/** Host: invite a waiting classmate into my room. */
export async function sendInvite(
  gameId: string,
  uid: string,
  code: string,
): Promise<void> {
  const user = getAuthenticatedUser();
  const grade = myGrade();
  if (user === null || grade === undefined) return;
  await set(ref(getRealtimeDb(), `${listPath(grade, gameId, uid)}/invite`), {
    code,
    fromUid: user.uid,
    fromName: myName(),
    at: Date.now(),
  } satisfies GameInvite);
}
