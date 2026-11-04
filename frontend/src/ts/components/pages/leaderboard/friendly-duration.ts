const plural = (n: number, word: string): string =>
  `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Kid-readable countdown: "4 days 2 hours", "5 hours 12 min", "3 min",
 * "less than a minute". Replaces raw "04:02:17:44" style timers.
 */
export function friendlyDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  if (days > 0) {
    return hours > 0
      ? `${plural(days, "day")} ${plural(hours, "hour")}`
      : plural(days, "day");
  }
  if (hours > 0) {
    return minutes > 0
      ? `${plural(hours, "hour")} ${minutes} min`
      : plural(hours, "hour");
  }
  if (minutes > 0) return `${minutes} min`;
  return "less than a minute";
}
