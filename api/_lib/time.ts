const TOKYO_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Calendar date in Japan, independent of the Vercel runtime timezone. */
export function tokyoDateString(timestamp = Date.now()): string {
  return new Date(timestamp + TOKYO_OFFSET_MS).toISOString().slice(0, 10);
}

/** Integer calendar-day bucket using midnight in Japan. */
export function tokyoDayId(timestamp = Date.now()): number {
  return Math.floor((timestamp + TOKYO_OFFSET_MS) / DAY_MS);
}

/** UTC timestamp of Monday 00:00 JST for the requested Japan week. */
export function tokyoWeekId(timestamp = Date.now(), weeksBefore = 0): number {
  const shifted = new Date(
    timestamp + TOKYO_OFFSET_MS - weeksBefore * 7 * DAY_MS,
  );
  const daysSinceMonday = (shifted.getUTCDay() + 6) % 7;
  return (
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate() - daysSinceMonday,
    ) - TOKYO_OFFSET_MS
  );
}
