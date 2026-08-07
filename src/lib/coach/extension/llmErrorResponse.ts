import { NextResponse } from "next/server";
import { LlmError } from "@/lib/llm/errors";

/**
 * Map an error thrown by a generative Sales Coach extension engine to the right HTTP response.
 *
 * The three generative routes (summarize / copilot / formulate) shared this EXACT mapping inline: an
 * LlmError rate-limit → 429 (so the client backs off correctly), any other LlmError → its own status
 * (default 502), and a non-LLM failure → a logged generic 502. Centralized here so the error taxonomy lives
 * in ONE place (§A21) — if a new LlmError kind or a different status mapping is ever needed, it changes once,
 * not in three hand-rolled copies that would drift.
 *
 * The client NEVER receives `err.message`. The provider layer builds that from raw upstream text — e.g.
 * `DeepSeek API error 400: <200 chars of body>` or `"DEEPSEEK_API_KEY not set."` — so returning it would
 * leak the AI vendor's identity and the upstream error body to the browser (CWE-209). Instead the real cause
 * is logged server-side (the only place it belongs), and the client gets the caller's generic
 * `fallbackMessage` plus the safe `kind` enum + status code, which are what drive its back-off / retry.
 *
 * (The read-only tools dissect + coach do NOT use this — their engines never throw, they honest-empty. This
 * is only for the generative tools whose engine lets an LlmError propagate.)
 */
export function llmErrorResponse(
  err: unknown,
  opts: { logTag: string; fallbackMessage: string }
): NextResponse {
  if (err instanceof LlmError) {
    // The real cause is logged here and ONLY here — never sent to the client (CWE-209, see docstring).
    console.error(
      `[${opts.logTag}] LLM error kind=${err.kind} provider=${err.provider} status=${err.status ?? "?"}:`,
      err.message,
      err.rawBody ? `raw=${err.rawBody.slice(0, 500)}` : ""
    );
    return NextResponse.json(
      { error: opts.fallbackMessage, kind: err.kind },
      { status: err.kind === "rate_limit" ? 429 : (err.status ?? 502) }
    );
  }
  console.error(`[${opts.logTag}] non-LLM failure:`, err);
  return NextResponse.json({ error: opts.fallbackMessage }, { status: 502 });
}
