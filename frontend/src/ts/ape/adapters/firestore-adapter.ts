import { AppRouter, initClient, type ApiFetcherArgs } from "@ts-rest/core";
import { getAuthenticatedUser } from "../../firebase";
import { dispatch } from "../firestore/router";

function tryJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function parseBody(req: ApiFetcherArgs): unknown {
  const raw = (req as unknown as { rawBody?: unknown }).rawBody;
  if (raw !== undefined) return raw;
  const body = req.body;
  if (typeof body === "string") return tryJsonParse(body);
  return body;
}

function parseQuery(req: ApiFetcherArgs): Record<string, unknown> {
  const rawQuery = (req as unknown as { rawQuery?: unknown }).rawQuery;
  if (rawQuery !== undefined && rawQuery !== null) {
    return rawQuery as Record<string, unknown>;
  }
  const out: Record<string, unknown> = {};
  try {
    const url = new URL(req.path);
    url.searchParams.forEach((v, k) => {
      out[k] = tryJsonParse(v);
    });
  } catch {
    // ignore
  }
  return out;
}

function parseParams(req: ApiFetcherArgs): Record<string, string> {
  const template = (req.route?.path ?? "").split("/").filter(Boolean);
  const params: Record<string, string> = {};
  if (template.length === 0) return params;
  try {
    const url = new URL(req.path);
    const actual = url.pathname.split("/").filter(Boolean);
    const tail = actual.slice(Math.max(0, actual.length - template.length));
    template.forEach((segment, i) => {
      if (segment.startsWith(":")) {
        params[segment.slice(1)] = decodeURIComponent(tail[i] ?? "");
      }
    });
  } catch {
    // ignore
  }
  return params;
}

async function firestoreApi(request: ApiFetcherArgs): Promise<{
  status: number;
  body: unknown;
  headers: Headers;
}> {
  try {
    const result = await dispatch(request.route, {
      params: parseParams(request),
      query: parseQuery(request),
      body: parseBody(request),
      uid: getAuthenticatedUser()?.uid ?? null,
    });
    return {
      status: result.status,
      body: result.body,
      headers: new Headers(),
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return { status: 500, body: { message }, headers: new Headers() };
  }
}

// oxlint-disable-next-line explicit-function-return-type
export function buildClient<T extends AppRouter>(
  contract: T,
  _baseUrl?: string,
  _timeout?: number,
) {
  return initClient(contract, {
    baseUrl: "https://firestore.invalid",
    jsonQuery: true,
    api: firestoreApi,
    baseHeaders: {
      Accept: "application/json",
    },
  });
}
