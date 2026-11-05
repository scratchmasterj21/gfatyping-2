import type { RaceParticipant, RaceStanding, TugTeam } from "./race-types";

export type TugTotals = { red: number; blue: number };
export type TugOutcome = TugTeam | "draw";

/** Tug of War coins - higher than a class race since it's a rare event. */
export const TUG_COINS = { participation: 10, winningTeam: 25, mvp: 15 };

/**
 * Split players into two even teams. Shuffled first so friends who joined
 * together don't always land on the same side; sizes differ by at most one.
 */
export function assignTeams(
  uids: string[],
  rng: () => number = Math.random,
): Record<string, TugTeam> {
  const order = [...uids];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j] as string, order[i] as string];
  }
  const teams: Record<string, TugTeam> = {};
  order.forEach((uid, i) => {
    teams[uid] = i % 2 === 0 ? "red" : "blue";
  });
  return teams;
}

/** Words pulled per team. Players without a team (joined late) don't count. */
export function teamTotals(
  participants: Pick<RaceParticipant, "uid" | "wordIndex">[],
  teams: Record<string, TugTeam> | undefined,
): TugTotals {
  const totals: TugTotals = { red: 0, blue: 0 };
  for (const p of participants) {
    const team = teams?.[p.uid];
    if (team !== undefined) totals[team] += Math.max(0, p.wordIndex);
  }
  return totals;
}

/** How far the rope has moved: -1 = all the way to red, +1 = all the way to blue. */
export function ropeOffset(totals: TugTotals, winMargin: number): number {
  const lead = totals.blue - totals.red;
  return Math.max(-1, Math.min(1, lead / Math.max(1, winMargin)));
}

/**
 * Lead (in words) that drags the flag over a team's line and ends the game
 * early. Scales with class size so a big class can't win in seconds.
 */
export function tugWinMargin(playerCount: number): number {
  return 20 + playerCount * 3;
}

export function tugOutcome(totals: TugTotals): TugOutcome {
  if (totals.red === totals.blue) return "draw";
  return totals.red > totals.blue ? "red" : "blue";
}

/**
 * Coins for one player: participation for finishing, a bonus for everyone on
 * the winning team, and an MVP bonus for the top puller (ties: everyone tied).
 */
export function tugCoins(
  standing: RaceStanding,
  outcome: TugOutcome,
  mvpWords: number,
): number {
  if (standing.finishedAt <= 0 || standing.team === undefined) return 0;
  let coins = TUG_COINS.participation;
  if (outcome === standing.team) coins += TUG_COINS.winningTeam;
  if (mvpWords > 0 && (standing.words ?? 0) === mvpWords) {
    coins += TUG_COINS.mvp;
  }
  return coins;
}
