// coach-api.ts — the client for the coach REST/AI routes that authenticate with a Bearer token.
//
// These are the SAME routes the browser extension calls. The AI routes under /api/coach/extension/** already
// accept `Authorization: Bearer <supabase access token>` today — so "Suggested Response" and "Prospect Intel"
// work from the app with ZERO backend change. The session/KPI/audio routes under /api/coach/sales-session/**
// and /api/coach/kpi/** are web-cookie-only until the Phase-2 Bearer shim lands (see 06-BACKEND-BEARER-SHIM.md);
// this client already sends the Bearer, so those endpoints light up the moment the shim is deployed — no app
// change needed.
//
// We do NOT re-implement the extension's manual refresh dance: supabase-js owns single-flight refresh + rotation
// internally (that whole class of "kicked out again and again" bugs is handled by the library here). On a 401 we
// force one refresh and retry once, then surface an honest error.

import { fetch as expoFetch } from "expo/fetch"; // streaming-capable fetch (native ReadableStream) for SSE
import { supabase, currentAccessToken } from "./supabase";
import { ENV } from "./env";
import type { SuggestResult, SuggestStreamEvent } from "../types/backend";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** A JSON POST to a coach route with the Bearer token, refreshing once on a 401. */
export async function coachPost<T>(path: string, body: unknown): Promise<T> {
  const call = async (token: string | null) =>
    fetch(ENV.API_BASE + path, {
      method: "POST",
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
    throw new ApiError(res.status, (data && (data as any).error) || `HTTP ${res.status}`);
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
    const snippet = await res.text().catch(() => "");
    yield { type: "error", error: snippet.slice(0, 300) || `HTTP ${res.status}` };
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
