import { isSalesCall, NOT_A_SALES_CALL } from "@/lib/coach/v5/salesOnly";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { getSession } from "@/lib/data/salesCoach";
import { askCoach } from "@/lib/coach/remote/askCoach";

/**
 * POST /api/coach/sales-session/[id]/ask-coach
 *
 * Ask Coach on a session. The C.A.R.E ask-coach grades a DRAFT reply
 * before sending; a post-call session has no draft, so here it means:
 * the agent asks a free-form question about the conversation and gets
 * coaching grounded in the transcript + sales methodology. (Interpretation
 * surfaced in the build report — confirm it matches intent.)
 *
 * Obeys the tone law (§3.3/§3.4): kind, growth-oriented, specific to the
 * transcript, never a verdict.
 *
 * RSS Phase 6 (2026-11-20): multi-turn and saved (`chatId`), answering with [n] citations that resolve to a line
 * and its time — the engine is askCoach (one module for this route and the cross-call ask).
 */

const Body = z.object({
  question: z.string().min(3).max(2000),
  /** Continue a saved chat (RSS Phase 6). Omit to start one. */
  chatId: z.string().uuid().optional(),
});

// The coach's instructions (and the citation rule) live in src/lib/coach/remote/askCoach.ts ASK_SYSTEM.

// LLM route: allow a longer LLM/stream budget than Vercel's short default (class-swept
// 2026-07-09 — 50e4ba1 declared maxDuration on finalize/summarize only; this closes the class).
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req, {
    id: "sales-session-ask-coach",
    windowMs: 60_000,
    max: 30,
  });
  if (limited) return limited;

  const { id } = await context.params;
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const companyId = (await getCurrentCompanyId()) ?? undefined;

  const session = await getSession(id);
  if (!session) {
    return NextResponse.json(
      { error: "Session not found or not accessible." },
      { status: 404 }
    );
  }
  // Sales calls only (2026-10-09, salesOnly.ts): meetings and huddles have their own review; no sales engine runs.
  if (!isSalesCall(session.sessionKind)) return NextResponse.json(NOT_A_SALES_CALL, { status: 409 });
  // RSS Phase 6 (0281): multi-turn, saved, with [n] line citations — src/lib/coach/remote/askCoach.ts. The transcript
  // is read and fenced (CONVERSATION_IS_DATA) inside askCoach, through this caller's own client.
  const r = await askCoach({
    db: supabase,
    companyId: companyId ?? session.companyId,
    userId: auth.user.id,
    sessionIds: [id],
    question: body.question,
    chatId: body.chatId ?? null,
  });
  if (!r.ok) {
    if (r.status === 502) console.error("[coach/sales-session/ask-coach] empty answer from model (not suppressed)");
    return NextResponse.json({ error: r.error }, { status: r.status });
  }
  if (r.suppressed) return NextResponse.json({ answer: null, suppressed: true });
  return NextResponse.json({ answer: r.answer, chatId: r.chatId, citations: r.citations });
}
