import { callApi } from "../../api-client";
import { getAuthenticatedUser } from "../../firebase";
import { isAuthenticated } from "../../states/core";
import { betterGhost, CarLook, DEFAULT_LOOK, Ghost } from "./race-rules";

/**
 * Per-device conveniences (my car look, my best-race ghost) live in
 * localStorage; garage points live on the server (api/claim-reward,
 * type "racerGarage") so unlocks follow the student between iPads.
 */

const who = (): string => getAuthenticatedUser()?.uid ?? "guest";
const lookKey = (): string => `racer-look:${who()}`;
const ghostKey = (target: number): string => `racer-ghost:${who()}:${target}`;

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
    // storage full / blocked: not important
  }
}

export const loadLook = (): CarLook => ({
  ...DEFAULT_LOOK,
  ...read<Partial<CarLook>>(lookKey()),
});
export const saveLook = (look: CarLook): void => write(lookKey(), look);

export function loadGhost(target: number): Ghost | null {
  const g = read<Ghost>(ghostKey(target));
  return g !== null && Array.isArray(g.d) && g.target === target ? g : null;
}

/** Keep this race if it beat my best on this length; true if it did. */
export function offerGhost(g: Ghost): boolean {
  const old = loadGhost(g.target);
  if (!betterGhost(old, g)) return false;
  write(ghostKey(g.target), g);
  return true;
}

/** Add garage points (0 just reads) and get my total. */
export async function claimGaragePoints(points: number): Promise<number> {
  if (!isAuthenticated()) return 0;
  const res = await callApi<{ points: number }>("/api/claim-reward", {
    type: "racerGarage",
    score: Math.max(0, Math.min(8, Math.round(points))),
  });
  return typeof res.points === "number" ? res.points : 0;
}
