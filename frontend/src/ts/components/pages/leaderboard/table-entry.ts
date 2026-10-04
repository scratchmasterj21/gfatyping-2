import {
  LeaderboardEntry,
  XpLeaderboardEntry,
} from "@monkeytype/schemas/leaderboards";

import { RaceLeaderboardEntry } from "../../../classroom/classroom";

export type TableEntry =
  | LeaderboardEntry
  | XpLeaderboardEntry
  | RaceLeaderboardEntry;
