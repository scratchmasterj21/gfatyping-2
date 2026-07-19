export const CLASS_IDS = [
  "G1A",
  "G1B",
  "G2A",
  "G2B",
  "G3A",
  "G3B",
  "G4A",
  "G4B",
  "G5A",
  "G5B",
  "G6A",
  "G6B",
] as const;
export type ClassId = (typeof CLASS_IDS)[number];

export const GRADES = ["G1", "G2", "G3", "G4", "G5", "G6"] as const;
export type Grade = (typeof GRADES)[number];

/** Grade portion of a class id, e.g. "G3A" -> "G3". */
export function gradeOf(classId: string): string {
  return classId.slice(0, 2);
}
