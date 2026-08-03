import type { VercelRequest } from "@vercel/node";
import admin from "firebase-admin";

import { getAdminApp } from "./admin.js";

const DOMAIN = "@felice.ed.jp";

export type AuthResult =
  | { ok: true; uid: string; email: string }
  | { ok: false; status: number; message: string };

/**
 * Verifies the caller's Firebase ID token (sent as `Authorization: Bearer
 * <token>`) and confirms the email is on the school domain. Every trusted
 * endpoint under api/ must call this before touching Firestore - it's the
 * only thing standing between "any authenticated student" and "this
 * specific student", since the Admin SDK these endpoints use bypasses
 * firestore.rules entirely. Same verification already proven in
 * refresh-leaderboard-cache.ts, extracted here so every endpoint doesn't
 * reimplement it slightly differently.
 */
export async function verifyStudent(req: VercelRequest): Promise<AuthResult> {
  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (token === "") {
    return { ok: false, status: 401, message: "Missing Authorization header" };
  }

  let app: admin.app.App;
  try {
    app = getAdminApp();
  } catch (e) {
    return { ok: false, status: 500, message: (e as Error).message };
  }

  try {
    const decoded = await app.auth().verifyIdToken(token);
    if (decoded.email === undefined || !decoded.email.endsWith(DOMAIN)) {
      return { ok: false, status: 403, message: "Forbidden" };
    }
    return { ok: true, uid: decoded.uid, email: decoded.email };
  } catch {
    return { ok: false, status: 401, message: "Invalid or expired token" };
  }
}

/** True for the single hardcoded admin/teacher account - mirrors isAdminUser() in firestore.rules. */
export function isAdminEmail(email: string): boolean {
  return email === "john.limpiada@felice.ed.jp";
}
