export function remainingTurnMs(deadline: number, now: number): number {
  return Math.max(0, deadline - now);
}

export function activeElapsedSeconds(
  startedAt: number,
  now: number,
  pausedDurationMs: number,
): number {
  return Math.round(Math.max(0, now - startedAt - pausedDurationMs) / 1000);
}

export function encounterIsSafe(
  hasMoved: boolean,
  safeUntilAt: number,
  now: number,
): boolean {
  return !hasMoved || now < safeUntilAt;
}

export function canMoveNearPlayerDuringSafety(
  currentDistance: number,
  nextDistance: number,
  safeDistance: number,
): boolean {
  return nextDistance >= safeDistance || nextDistance > currentDistance;
}
