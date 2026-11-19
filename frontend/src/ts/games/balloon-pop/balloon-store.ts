import { callApi } from "../../api-client";
import { getAuthenticatedUser } from "../../firebase";
import { isAuthenticated } from "../../states/core";

/**
 * Level stars live on the server (api/claim-reward, type "balloonStars") so
 * they follow the student between iPads; signed out, they stay on this
 * device. Today's goal progress is a per-device count.
 */

const who = (): string => getAuthenticatedUser()?.uid ?? "guest";
const localKey = (): string => `balloon-stars:${who()}`;
const dailyKey = (day: number): string => `balloon-daily:${who()}:${day}`;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}
function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // not important
  }
}

/** level id -> best stars */
export type StarMap = Record<number, number>;

const fromServer = (raw: Record<string, number>): StarMap => {
  const out: StarMap = {};
  for (const [k, v] of Object.entries(raw)) {
    const id = Number(k.replace(/^l/, ""));
    if (Number.isFinite(id)) out[id] = v;
  }
  return out;
};

/** Save a level result (0 = just read) and get every level's best. */
export async function saveStars(
  level: number,
  stars: number,
): Promise<StarMap> {
  const local = read<StarMap>(localKey()) ?? {};
  if (level > 0 && stars > (local[level] ?? 0)) {
    local[level] = stars;
    write(localKey(), local);
  }
  if (!isAuthenticated()) return local;
  try {
    const res = await callApi<{ stars: Record<string, number> }>(
      "/api/claim-reward",
      {
        type: "balloonStars",
        wave: level,
        score: stars,
      },
    );
    const server = fromServer(res.stars ?? {});
    const merged: StarMap = { ...local };
    for (const [k, v] of Object.entries(server)) {
      merged[Number(k)] = Math.max(merged[Number(k)] ?? 0, v);
    }
    write(localKey(), merged);
    return merged;
  } catch {
    return local;
  }
}

export const loadLocalStars = (): StarMap => read<StarMap>(localKey()) ?? {};

export const dailyCount = (day: number): number =>
  read<number>(dailyKey(day)) ?? 0;
export function addDaily(day: number, n: number): number {
  const next = dailyCount(day) + n;
  write(dailyKey(day), next);
  return next;
}
