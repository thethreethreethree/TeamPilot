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
 * INTENTIONAL — do NOT "fix" the LlmError branch to a generic message. Surfacing the LlmError cause
 * ({error, kind}) to the AUTHENTICATED, entitled, same-tenant extension user is a deliberate design decision
 * (2026-07-25), and the full-app CWE-209 sweep (docs/audits/2026-07-31-cwe209-error-leak-sweep.md) explicitly
 * classified every `instanceof LlmError` surface as intentional and left it untouched. This mirrors the C.A.R.E
 * extension + the ~25 other authed AI routes. CWE-209 governs the PUBLIC/unauthed 500-leak class, not this
 * trusted-agent surface. (A stricter provider-cause-trimming policy — e.g. drop the raw upstream body from
 * err.message while keeping kind — is a codebase-wide founder decision, not a per-route change.)
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
