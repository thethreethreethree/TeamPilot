import { NextRequest, NextResponse } from "next/server";
import { proposeDecisionDialogue } from "@/lib/claude";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { createClient } from "@/lib/supabase/server";
import { readBody, DialogueDecisionSchema } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { LlmError } from "@/lib/llm/errors";

/**
 * POST /api/coach/sales-session/decision-dialogue
 *
 * Sales-Coach-dedicated decision dialogue (§3.3 guide-don't-overtake): the
 * agent gives their own diagnosis + proposal first, the System responds with
 * added perspective + a why — it never overtakes.
 *
 * Same ENGINE as the Elostate /api/ai/decision-dialogue
 * (proposeDecisionDialogue, §A21 — reused, not forked) and the same
 * validation schema, but controlExempt: Sales Coach runs day-1 (founder
 * 2026-06-30). The exemption is HARDCODED here, NOT a client-settable flag —
 * so the shared Elostate endpoint stays gated and cannot be bypassed (§1.5).
 */
// LLM route: allow a longer LLM/stream budget than Vercel's short default (class-swept
// 2026-07-09 — 50e4ba1 declared maxDuration on finalize/summarize only; this closes the class).
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "coach-decision-dialogue",
    windowMs: 60_000,
    max: 10,
  });
  if (limited) return limited;

  const body = await readBody(req, DialogueDecisionSchema);
  if (body instanceof NextResponse) return body;

  // Auth gate (audit 2026-07-09): require an authenticated user before the LLM call.
  // controlExempt (below) is about the §3.4 control window, NOT authentication — this
  // route had neither an auth nor a role check, so an anon caller reached the model.
  const authClient = await createClient();
  const { data: authData } = await authClient.auth.getUser();
  if (!authData?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const companyId = (await getCurrentCompanyId()) ?? undefined;
    const r = await proposeDecisionDialogue({
      ...body,
      companyId,
      controlExempt: true,
    });
    if (r.suppressed) {
      return NextResponse.json(
        { suppressed: true, reason: r.reason },
        { status: 200 }
      );
    }
    const parsed = JSON.parse(r.text);
    return NextResponse.json({ ...parsed, provider: r.provider, model: r.model });
  } catch (err) {
    if (err instanceof LlmError) {
      return NextResponse.json(
        { error: err.message, kind: err.kind, provider: err.provider },
        { status: err.kind === "rate_limit" ? 429 : err.status ?? 502 }
      );
    }
    console.error("[coach/decision-dialogue] non-LLM failure:", err);
    return NextResponse.json(
      { error: "Decision dialogue failed." },
      { status: 500 }
    );
  }
}
