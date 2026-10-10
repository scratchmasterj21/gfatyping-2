import type { StudentSummary } from "./assignments";

const BATCH_KEY = "gfaCertificateBatch";
const BATCH_MAX_AGE_MS = 60 * 60 * 1000;

/** Hand certificate data from the Classroom page to a new tab without re-reading Firestore. */
export function storeCertificateBatch(list: StudentSummary[]): void {
  localStorage.setItem(
    BATCH_KEY,
    JSON.stringify({ savedAt: Date.now(), list }),
  );
}

export function readCertificateBatch(): StudentSummary[] {
  try {
    const raw = localStorage.getItem(BATCH_KEY);
    if (raw === null) return [];
    const parsed = JSON.parse(raw) as {
      savedAt?: number;
      list?: StudentSummary[];
    };
    if (Date.now() - (parsed.savedAt ?? 0) > BATCH_MAX_AGE_MS) return [];
    return Array.isArray(parsed.list) ? parsed.list : [];
  } catch {
    return [];
  }
}
