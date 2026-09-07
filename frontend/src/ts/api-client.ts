import { getIdToken } from "./firebase";

export class ApiError extends Error {
  public readonly status: number;

  constructor(status: number, path: string) {
    super(`Request to ${path} failed (${status})`);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Calls one of the validated Vercel API endpoints under api/ (Firebase
 * Admin SDK, bypasses firestore.rules) instead of writing coins/xp/owned
 * items/leaderboard entries straight from the client, which any student
 * could otherwise fake via devtools. See api/_lib/auth.ts for the other
 * side of this contract.
 */
export async function callApi<T>(path: string, body: unknown): Promise<T> {
  const token = await getIdToken();
  if (token === null) throw new Error("Not signed in");

  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new ApiError(response.status, path);
  }
  return (await response.json()) as T;
}
