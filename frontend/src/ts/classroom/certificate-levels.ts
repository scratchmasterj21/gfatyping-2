export type LessonMark = { at: number; stars: number };

export type CertificateStats = {
  lessonsCompleted: number;
  lessonStars: number;
  bestWpm: number;
  lessonMarks?: LessonMark[];
};

export type CertificateLevel = {
  id: "bronze" | "silver" | "gold" | "star";
  name: string;
  lessons: number;
  stars: number;
  wpm: number;
};

/** Reachable across grades 1–6. Star is a long goal, not a first-term one. */
export const CERTIFICATE_LEVELS: CertificateLevel[] = [
  { id: "bronze", name: "Bronze", lessons: 5, stars: 5, wpm: 8 },
  { id: "silver", name: "Silver", lessons: 15, stars: 25, wpm: 15 },
  { id: "gold", name: "Gold", lessons: 30, stars: 60, wpm: 25 },
  { id: "star", name: "Star", lessons: 45, stars: 100, wpm: 35 },
];

export function levelEarned(
  level: CertificateLevel,
  stats: CertificateStats,
): boolean {
  return (
    stats.lessonsCompleted >= level.lessons &&
    stats.lessonStars >= level.stars &&
    stats.bestWpm >= level.wpm
  );
}

export function earnedLevels(stats: CertificateStats): CertificateLevel[] {
  return CERTIFICATE_LEVELS.filter((level) => levelEarned(level, stats));
}

export function nextLevel(
  stats: CertificateStats,
): CertificateLevel | undefined {
  return CERTIFICATE_LEVELS.find((level) => !levelEarned(level, stats));
}

/**
 * When lesson count and stars both crossed this level.
 * Speed is checked separately against the current best, so this date can be
 * earlier than the day the speed goal was met.
 */
export function reachedOn(
  level: CertificateLevel,
  marks: LessonMark[] | undefined,
): number | undefined {
  if (marks === undefined || marks.length === 0) return undefined;
  const sorted = marks.slice().sort((a, b) => a.at - b.at);
  let lessons = 0;
  let stars = 0;
  for (const mark of sorted) {
    lessons += 1;
    stars += mark.stars;
    if (lessons >= level.lessons && stars >= level.stars && mark.at > 0) {
      return mark.at;
    }
  }
  return undefined;
}

export function stillNeeds(
  level: CertificateLevel,
  stats: CertificateStats,
): string {
  const parts: string[] = [];
  const lessonsLeft = level.lessons - stats.lessonsCompleted;
  const starsLeft = level.stars - stats.lessonStars;
  const wpmLeft = Math.ceil(level.wpm - stats.bestWpm);
  if (lessonsLeft > 0) parts.push(`${lessonsLeft} more lessons`);
  if (starsLeft > 0) parts.push(`${starsLeft} more stars`);
  if (wpmLeft > 0) parts.push(`${wpmLeft} more wpm`);
  return parts.length > 0 ? parts.join(" · ") : "all set";
}
