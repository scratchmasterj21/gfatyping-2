import { deleteField, doc, writeBatch } from "firebase/firestore";

import { getDb } from "../firebase";
import type { Student } from "./classroom";

/**
 * New school year: every student moves up a grade, keeping their class
 * letter (G3A -> G4A). G6 students graduate - their class is cleared and
 * they're hidden from class lists, but their account, coins, house and
 * lessons all stay. Each student remembers where they were (`rollover`), so
 * the whole move can be undone.
 */

/** Undo is offered for this long after a move-up. */
export const UNDO_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
/** Firestore allows 500 writes per batch. */
const BATCH_SIZE = 400;

export type RolloverMove = { uid: string; from: string; to: string | null };

export type RolloverPlan = {
  moves: RolloverMove[];
  /** how many students move from each class, and where to */
  byClass: { from: string; to: string | null; count: number }[];
  graduates: number;
};

/** The class a student moves to; null = graduates; undefined = not a class we move. */
export function nextClassId(classId: string): string | null | undefined {
  const m = /^G([1-6])([A-Z])$/.exec(classId);
  if (m === null) return undefined;
  const grade = Number(m[1]);
  if (grade >= 6) return null;
  return `G${grade + 1}${m[2]}`;
}

export function planRollover(students: Student[]): RolloverPlan {
  const moves: RolloverMove[] = [];
  const counts = new Map<string, { to: string | null; count: number }>();
  for (const s of students) {
    if (s.graduated === true || s.classId === undefined) continue;
    const to = nextClassId(s.classId);
    if (to === undefined) continue;
    moves.push({ uid: s.uid, from: s.classId, to });
    const c = counts.get(s.classId) ?? { to, count: 0 };
    c.count++;
    counts.set(s.classId, c);
  }
  const byClass = [...counts.entries()]
    .map(([from, c]) => ({ from, to: c.to, count: c.count }))
    .sort((a, b) => a.from.localeCompare(b.from));
  return {
    moves,
    byClass,
    graduates: moves.filter((m) => m.to === null).length,
  };
}

async function writeInBatches<T>(
  items: T[],
  write: (batch: ReturnType<typeof writeBatch>, item: T) => void,
): Promise<void> {
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = writeBatch(getDb());
    for (const item of items.slice(i, i + BATCH_SIZE)) write(batch, item);
    await batch.commit();
  }
}

export async function applyRollover(
  plan: RolloverPlan,
  now = Date.now(),
): Promise<void> {
  await writeInBatches(plan.moves, (batch, m) => {
    batch.set(
      doc(getDb(), "users", m.uid),
      {
        classId: m.to,
        graduated: m.to === null ? true : deleteField(),
        rollover: { from: m.from, at: now },
      },
      { merge: true },
    );
  });
}

/** When the most recent move-up happened, if it can still be undone. */
export function lastRolloverAt(
  students: Student[],
  now = Date.now(),
): number | undefined {
  const latest = Math.max(0, ...students.map((s) => s.rollover?.at ?? 0));
  return latest > 0 && now - latest < UNDO_WINDOW_MS ? latest : undefined;
}

/** Students the last move-up touched (to put them back). */
export function studentsInRollover(students: Student[], at: number): Student[] {
  return students.filter((s) => s.rollover?.at === at);
}

export async function undoRollover(
  students: Student[],
  at: number,
): Promise<number> {
  const list = studentsInRollover(students, at);
  await writeInBatches(list, (batch, s) => {
    batch.set(
      doc(getDb(), "users", s.uid),
      {
        classId: s.rollover?.from ?? null,
        graduated: deleteField(),
        rollover: deleteField(),
      },
      { merge: true },
    );
  });
  return list.length;
}

/** Bring one graduated student back (into a class, or unassigned). */
export async function restoreGraduate(
  uid: string,
  classId: string | null,
): Promise<void> {
  const batch = writeBatch(getDb());
  batch.set(
    doc(getDb(), "users", uid),
    { classId, graduated: deleteField() },
    { merge: true },
  );
  await batch.commit();
}
