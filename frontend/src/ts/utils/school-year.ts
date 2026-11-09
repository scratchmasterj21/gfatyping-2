/**
 * Japanese school years run April to March. A school year is named by the
 * year it starts in: April 2026 - March 2027 is 2026 ("2026-27").
 */

const TOKYO_OFFSET_MS = 9 * 60 * 60 * 1000;

/** The school year (start year) a moment falls in, by Japan time. */
export function schoolYearOf(timestamp: number): number {
  const d = new Date(timestamp + TOKYO_OFFSET_MS);
  const year = d.getUTCFullYear();
  // getUTCMonth: 0 = January, 3 = April
  return d.getUTCMonth() >= 3 ? year : year - 1;
}

export function currentSchoolYear(now = Date.now()): number {
  return schoolYearOf(now);
}

/** 2026 -> "2026-27" */
export function schoolYearLabel(year: number): string {
  return `${year}-${String((year + 1) % 100).padStart(2, "0")}`;
}
