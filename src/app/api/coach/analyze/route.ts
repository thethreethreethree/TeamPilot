import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { proposeCoachPatterns, type CoachLlmHit } from "@/lib/claude";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { LlmError } from "@/lib/llm/errors";

/**
 * POST /api/coach/analyze
 *
 * Coach v3 LLM pass — identifies communication patterns the regex
 * cannot read (blame projection in non-canonical forms, hot-state
 * signaling, emotional escalation with novel vocabulary).
 *
 * Constitutional grounding (asset A11, mirror frame):
 *   - The LLM identifies which canonical pattern shape is present
 *     (factual). It does NOT render a verdict.
 *   - Output is constrained to seven pattern IDs; the LLM cannot
 *     invent a new pattern name. The chip surfaces a count + question;
 *     the user judges meaning.
 *   - If the LLM is wrong about a detection, the user dismisses the
 *     chip — dismiss rate per heuristic is the §4 readout signal.
 *
 * Tightly rate-limited (12/minute per user) because each call costs
 * a real LLM round trip. The client only fires after 1.2s of typing
 * inactivity on drafts >= 20 chars, so the per-user steady-state
 * load is well under the limit.
 */

const AnalyzeSchema = z.object({
  draft: z.string().min(6).max(8000),
  recentThread: z.string().max(4000).optional(),
  // v3.2: regex hits the instant detector already surfaced. The LLM
  // renders a verdict on each (confirmed / uncertain / vetoed) +
  // provides a context-specific note. Client passes [] if none.
  regexHits: z
    .array(
      z.object({
        pattern_id: z.string().max(64),
        trigger_excerpt: z.string().max(280),
      })
    )
    .max(10)
    .optional(),
});

const ALLOWED_PATTERN_IDS = new Set<CoachLlmHit["pattern_id"]>([
  "nvc-evaluation",
  "voss-bare-assertion",
  "stone-identity-collision",
  "coach-blame-projection",
  "coach-emotional-escalation",
  "coach-hot-state",
  "coach-aggressive-language",
]);

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "coach-analyze",
    windowMs: 60_000,
    max: 12,
  });
  if (limited) return limited;

  const body = await readBody(req, AnalyzeSchema);
  if (body instanceof NextResponse) return body;

  try {
    const companyId = (await getCurrentCompanyId()) ?? undefined;
    const r = await proposeCoachPatterns({
      draft: body.draft,
      recentThread: body.recentThread,
      regexHits: body.regexHits,
      companyId,
    });
    if (r.suppressed) {
      return NextResponse.json(
        { suppressed: true, reason: r.reason, hits: [] },
        { status: 200 }
      );
    }
    const parsed = JSON.parse(r.text) as { hits?: CoachLlmHit[] };

    // Filter to allowed pattern IDs even if the LLM goes off-script.
    // Constitutional defense: the LLM's vocabulary is constrained at the
    // application layer, not just in the prompt.
    // v3.2: filter against the constrained vocabulary AND validate the
    // verdict + context_note fields. Each filter is defense-in-depth
    // against the LLM going off-script.
    const hits: CoachLlmHit[] = Array.isArray(parsed.hits)
      ? parsed.hits.filter(
          (h) =>
            h &&
            typeof h.pattern_id === "string" &&
            ALLOWED_PATTERN_IDS.has(h.pattern_id) &&
            typeof h.trigger_excerpt === "string" &&
            h.trigger_excerpt.length > 0 &&
            ["high", "medium", "low"].includes(h.confidence) &&
            ["confirmed", "uncertain", "vetoed"].includes(h.verdict) &&
            typeof h.context_note === "string" &&
            h.context_note.length > 0 &&
            h.context_note.length <= 400
        )
      : [];

    return NextResponse.json({
      hits,
      provider: r.provider,
      model: r.model,
    });
  } catch (err) {
    if (err instanceof LlmError) {
      return NextResponse.json(
        { error: err.message, kind: err.kind, hits: [] },
        { status: err.kind === "rate_limit" ? 429 : err.status ?? 502 }
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error", hits: [] },
      { status: 500 }
    );
  }
}
