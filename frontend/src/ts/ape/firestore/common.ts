import { Firestore } from "firebase/firestore";
import { getAuthenticatedUser, getDb } from "../../firebase";

export type HandlerResult = { status: number; body: unknown };

export type HandlerContext = {
  params: Record<string, string>;
  query: Record<string, unknown>;
  body: unknown;
  uid: string | null;
};

export type Handler = (ctx: HandlerContext) => Promise<HandlerResult>;

/**
 * Thrown by handlers to short-circuit with a specific status code. The router
 * converts it into the ts-rest `{ status, body: { message } }` shape.
 */
export class HandlerError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "HandlerError";
  }
}

export function ok<T>(data: T, message = "ok"): HandlerResult {
  return { status: 200, body: { message, data } };
}

export function okMessage(message: string): HandlerResult {
  return { status: 200, body: { message } };
}

export function db(): Firestore {
  return getDb();
}

export function requireUid(ctx: HandlerContext): string {
  const uid = ctx.uid ?? getAuthenticatedUser()?.uid ?? null;
  if (uid === null) {
    throw new HandlerError(401, "You need to be authenticated.");
  }
  return uid;
}

/**
 * Firestore rejects `undefined` field values. Recursively strip them.
 */
export function stripUndefined<T>(value: T): T {
  return strip(value) as T;
}

function strip(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((it) => strip(it));
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) out[k] = strip(v);
    }
    return out;
  }
  return value;
}
