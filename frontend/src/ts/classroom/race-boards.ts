/**
 * The extra race rankings beyond race speed / accuracy: one number per
 * student, read straight from their user doc. Mirrored in
 * api/refresh-leaderboard-cache.ts (grade / school boards).
 */

export const RACE_STAT_METRICS = [
  "racewins",
  "raceblitz",
  "racetug",
  "racechamps",
  "raceplayed",
] as const;
export type RaceStatMetric = (typeof RACE_STAT_METRICS)[number];

export type RaceStatDoc = {
  raceWins?: number;
  raceTotalRaces?: number;
  raceBestBlitz?: number;
  raceBestTug?: number;
  championWins?: number;
};

export const RACE_STAT_BOARDS: Record<
  RaceStatMetric,
  {
    /** sidebar / title name */
    name: string;
    /** "ranked by ..." */
    rankedBy: string;
    /** unit after the number */
    label: string;
    icon:
      | "fa-trophy"
      | "fa-comment-dots"
      | "fa-users"
      | "fa-crown"
      | "fa-redo-alt";
    description: string;
    value: (d: RaceStatDoc) => number;
  }
> = {
  racewins: {
    name: "Race wins",
    rankedBy: "most races won",
    label: "wins",
    icon: "fa-trophy",
    description: "Most races won",
    value: (d) => d.raceWins ?? 0,
  },
  raceblitz: {
    name: "Word Blitz",
    rankedBy: "best Word Blitz score",
    label: "pts",
    icon: "fa-comment-dots",
    description: "Best Word Blitz points",
    value: (d) => d.raceBestBlitz ?? 0,
  },
  racetug: {
    name: "Tug of War",
    rankedBy: "most words pulled in Tug of War",
    label: "words",
    icon: "fa-users",
    description: "Most words pulled in one game",
    value: (d) => d.raceBestTug ?? 0,
  },
  racechamps: {
    name: "Class Champions",
    rankedBy: "championships won",
    label: "titles",
    icon: "fa-crown",
    description: "Class Championships won",
    value: (d) => d.championWins ?? 0,
  },
  raceplayed: {
    name: "Races played",
    rankedBy: "races played",
    label: "races",
    icon: "fa-redo-alt",
    description: "Races joined",
    value: (d) => d.raceTotalRaces ?? 0,
  },
};

export function isRaceStatMetric(metric: string): metric is RaceStatMetric {
  return (RACE_STAT_METRICS as readonly string[]).includes(metric);
}
