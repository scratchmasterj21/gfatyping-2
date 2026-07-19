import { Grade, gradeOf } from "./classes";

export type GradeGoal = {
  /** target best wpm at the default test (time 30, english) */
  wpm: number;
  /** target accuracy percent */
  acc: number;
};

/**
 * Age-appropriate typing targets per grade. Tuned to be reachable but
 * aspirational for elementary students.
 */
export const GRADE_GOALS: Record<Grade, GradeGoal> = {
  G1: { wpm: 10, acc: 95 },
  G2: { wpm: 15, acc: 95 },
  G3: { wpm: 20, acc: 95 },
  G4: { wpm: 25, acc: 95 },
  G5: { wpm: 30, acc: 95 },
  G6: { wpm: 35, acc: 95 },
};

/** Resolve the goal for a student's class id (e.g. "G3A" -> grade G3). */
export function goalForClass(
  classId: string | null | undefined,
): GradeGoal | undefined {
  if (classId === undefined || classId === null || classId === "") {
    return undefined;
  }
  const grade = gradeOf(classId) as Grade;
  return GRADE_GOALS[grade];
}
