// coach-api.ts — the client for the coach REST/AI routes that authenticate with a Bearer token.
//
// These are the SAME routes the browser extension calls. The AI routes under /api/coach/extension/** already
// accept `Authorization: Bearer <supabase access token>` today — so "Suggested Response" and "Prospect Intel"
// work from the app with ZERO backend change. The session/KPI/audio routes under /api/coach/sales-session/**
// and /api/coach/kpi/** were web-cookie-only until the Phase-2 Bearer shim landed.
//
// CORRECTED 2026-09-04, by reading `main` rather than trusting this comment: the
// shim IS merged. `callerScopedDb` is on main and used by twenty coach routes,
// and the KPI routes resolve a caller through `resolveApiAuth` — "the web cookie
// session OR a mobile Bearer token".
//
// The last cookie-only one, /api/coach/sales-session/coaching-material, is fixed
// on the branch `coaching-material-bearer` (founder decision `last-route`,
// 3 Sep). Once that branch is deployed, EVERY coach route this app calls accepts
// the app. The inventory was re-swept from the app's own fetch sites rather than
// from this comment: twenty-one distinct coach paths, and the only other
// cookie-only route in the list, /api/coach/v5/debrief, turned out not to be
// fetched at all — the app reads that event from the table directly.
//
// Whether `main` is DEPLOYED is a separate question this comment cannot answer.
// The 401 handling below stays exactly as it is: it is right whenever a route
// refuses the app, for whatever reason, and it must not be softened on the
// strength of a comment.
// this client already sends the Bearer, so those endpoints light up the moment the shim is deployed — no app
// change needed.
//
// We do NOT re-implement the extension's manual refresh dance: supabase-js owns single-flight refresh + rotation
// internally (that whole class of "kicked out again and again" bugs is handled by the library here). On a 401 we
// force one refresh and retry once, then surface an honest error.

import { fetch as expoFetch } from "expo/fetch"; // streaming-capable fetch (native ReadableStream) for SSE
import { supabase, currentAccessToken } from "./supabase";
import { ENV } from "./env";
import { classify401, type AuthFailure } from "./auth-failure";
import type { SuggestResult, SuggestStreamEvent } from "../types/backend";

/**
 * An error carrying the HTTP status the server answered with.
 *
 * WRITTEN WITHOUT A PARAMETER PROPERTY, deliberately, and this is not style.
 * `constructor(public status: number, ...)` is TypeScript syntax that EMITS
 * code, so Node's type-stripping refuses it — and this project's test runner
 * strips types rather than compiling them. The consequence was structural
 * rather than cosmetic: every module that imported this file became impossible
 * to test under plain Node, and that trap was hit four separate times, each
 * time answered by splitting the pure half of a module into a new file.
 *
 * A plain field assignment is identical at runtime and removes that blocker.
 *
 * IT IS NOT THE WHOLE STORY, and saying so matters: this file also imports
 * `expo/fetch`, a native module that cannot load under plain Node at all. So
 * importing coach-api from a test is still impossible, and the answer for a
 * module that has both pure rules and network calls is still to keep the rules
 * in their own file. This change removes one of two obstacles, not both.
 */
class ApiError extends Error {
  readonly status: number;
  /**
   * For a 401 only: whether the rep is signed out or the route refused a live
   * token. Computed ONCE here and consumed as a verdict — a screen that
   * re-derived it from `status` alone would be back to telling a signed-out rep
   * to wait for a deploy.
   */
  readonly authFailure: AuthFailure | null;
  /**
   * The server's own label for a deliberately-written error (its LLM taxonomy:
   * "rate_limit", "upstream", and so on). Its PRESENCE is what tells
   * `error-message.ts` that a 5xx body is a sentence somebody wrote rather than
   * a framework default.
   */
  readonly kind: string | null;

  constructor(
    status: number,
    message: string,
    authFailure: AuthFailure | null = null,
    kind: string | null = null,
  ) {
    super(message);
    this.status = status;
    this.kind = kind;
    this.authFailure = authFailure;
  }
}

/** A JSON POST to a coach route with the Bearer token, refreshing once on a 401. */
export async function coachPost<T>(path: string, body: unknown): Promise<T> {
  return coachWrite<T>("POST", path, body);
}

/** A JSON PATCH. Same envelope as POST — split by verb, not by a flag, so a
 *  retry can never re-send a POST as a PATCH or the other way round. */
export async function coachPatch<T>(path: string, body: unknown): Promise<T> {
  return coachWrite<T>("PATCH", path, body);
}


/**
 * Why a 401 survived the one refresh coach-api already performed.
 *
 * Asked AFTER the retry, so the session state here is the real answer: a token
 * that could not be renewed means the rep is signed out, and a live one means
 * the route rejected it.
 */
async function why401(): Promise<AuthFailure> {
  try {
    const { data } = await supabase.auth.getSession();
    const session = data?.session
      ? { expiresAt: typeof data.session.expires_at === "number" ? data.session.expires_at : null }
      : null;
    return classify401(session, Date.now());
  } catch {
    // Cannot tell — and the safe wrong answer is never to sign somebody out.
    return "route";
  }
}

async function coachWrite<T>(method: "POST" | "PATCH", path: string, body: unknown): Promise<T> {
  const call = async (token: string | null) =>
    fetch(ENV.API_BASE + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

  let res = await call(await currentAccessToken());
  if (res.status === 401) {
    await supabase.auth.refreshSession();
    res = await call(await currentAccessToken());
  }
  const text = await res.text();
  const data = text ? safeJson(text) : {};
  if (!res.ok) {
    throw new ApiError(
      res.status,
      (data && (data as any).error) || `HTTP ${res.status}`,
      res.status === 401 ? await why401() : null,
      typeof (data as any)?.kind === "string" ? (data as any).kind : null,
    );
  }
  return data as T;
}

/**
 * A JSON GET to a coach route with the Bearer token, refreshing once on a 401.
 *
 * The mirror of coachPost, and deliberately a separate function rather than a
 * method flag: a GET must never carry a body, and folding the two together is
 * how a retry ends up re-POSTing something that already succeeded.
 */
export async function coachGet<T>(path: string): Promise<T> {
  const call = async (token: string | null) =>
    fetch(ENV.API_BASE + path, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

  let res = await call(await currentAccessToken());
  if (res.status === 401) {
    await supabase.auth.refreshSession();
    res = await call(await currentAccessToken());
  }
  const text = await res.text();
  const data = text ? safeJson(text) : {};
  if (!res.ok) {
    throw new ApiError(
      res.status,
      (data && (data as any).error) || `HTTP ${res.status}`,
      res.status === 401 ? await why401() : null,
      typeof (data as any)?.kind === "string" ? (data as any).kind : null,
    );
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { error: text.slice(0, 300) };
  }
}

/** Non-streaming Suggested Response (co-pilot draft). Blank guidance → drafted from the conversation. */
export function suggestOnce(input: {
  conversation: string;
  guidance?: string;
  lastSpeaker?: "agent" | "customer";
}): Promise<SuggestResult> {
  return coachPost<SuggestResult>("/api/coach/extension/suggest", input);
}

/**
 * Streaming Suggested Response — yields delta/done/error events as the model generates, using expo/fetch's
 * streaming body. Consume with `for await (const ev of streamSuggest(...))`. Pass an AbortSignal to cancel
 * (stop billing the LLM) when the user leaves the screen mid-generation.
 */
export async function* streamSuggest(
  input: { conversation: string; guidance?: string; lastSpeaker?: "agent" | "customer" },
  signal?: AbortSignal,
): AsyncGenerator<SuggestStreamEvent> {
  const token = await currentAccessToken();
  const res = await expoFetch(ENV.API_BASE + "/api/coach/extension/suggest", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ ...input, stream: true }),
    signal,
  });

  if (res.status === 401) {
    yield { type: "error", error: "Your session expired. Sign in again." };
    return;
  }
  if (!res.ok || !res.body) {
    // READ THE BODY, DO NOT PASTE IT. This yielded `res.text()` verbatim, so a
    // route answering `{"error":"...","kind":"upstream"}` put raw JSON in front
    // of a rep — the same defect that printed a JSON blob under "Read the
    // prospect". The routes write a real sentence under `error`; take that.
    const snippet = await res.text().catch(() => "");
    yield { type: "error", error: errorSentence(snippet) ?? `HTTP ${res.status}` };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const ev = parseSseBlock(buffer.slice(0, idx));
        if (ev) yield ev;
        buffer = buffer.slice(idx + 2);
      }
    }
    const tail = parseSseBlock(buffer);
    if (tail) yield tail; // flush a trailing event with no terminating blank line
  } catch {
    // AbortError (user left the screen) or a network drop mid-stream.
    if (!signal?.aborted) yield { type: "error", error: "The connection was interrupted." };
  }
}

/**
 * The sentence out of an error body, or null when there is not one.
 *
 * READ THE BODY, DO NOT PASTE IT. The stream used to yield `res.text()`
 * verbatim, so a route answering `{"error":"...","kind":"upstream"}` put raw
 * JSON in front of a rep — the same defect that printed a JSON blob under "Read
 * the prospect". The routes write a real sentence under `error`; take that.
 */
function errorSentence(raw: string): string | null {
  const text = (raw ?? "").trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as { error?: unknown };
    const msg = typeof parsed?.error === "string" ? parsed.error.trim() : "";
    return msg || null;
  } catch {
    // Not JSON at all. A short plain-text body may still be a real sentence; a
    // long one is a stack trace or an HTML page and is worse than nothing.
    return text.length <= 200 && !text.startsWith("<") ? text : null;
  }
}

/** Parse one "event: X\ndata: {json}" SSE block into a typed event (mirrors the extension's relay). */
function parseSseBlock(raw: string): SuggestStreamEvent | null {
  let event = "message";
  let data = "";
  for (const line of raw.split("\n")) {
    const t = line.replace(/^\s+/, "");
    if (t.startsWith("event:")) event = t.slice(6).trim();
    else if (t.startsWith("data:")) data += t.slice(5).trim();
  }
  if (!data) return null;
  let parsed: any;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }
  if (event === "delta") return { type: "delta", text: String(parsed.text || "") };
  if (event === "done") return { type: "done", reply: parsed.reply, reasoning: parsed.reasoning };
  if (event === "error") return { type: "error", error: parsed.error, kind: parsed.kind };
  return null;
}

export { ApiError };
