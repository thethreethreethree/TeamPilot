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
 * (The read-only tools dissect + coach do NOT use this — their engines never throw, they honest-empty. This
 * is only for the generative tools whose engine lets an LlmError propagate.)
 */
export function llmErrorResponse(
  err: unknown,
  opts: { logTag: string; fallbackMessage: string }
): NextResponse {
  if (err instanceof LlmError) {
    return NextResponse.json(
      { error: err.message, kind: err.kind },
      { status: err.kind === "rate_limit" ? 429 : (err.status ?? 502) }
    );
  }
  console.error(`[${opts.logTag}] non-LLM failure:`, err);
  return NextResponse.json({ error: opts.fallbackMessage }, { status: 502 });
}
