import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { getSession, getSessionTranscript } from "@/lib/data/salesCoach";
import { generateSessionWhy, type SessionWhy } from "@/lib/coach/v5/salesWhy";

/**
 * /api/coach/sales-session/[id]/why  (Sessions Phase 3 — the WHY engine)
 *
 * §3.3 (guide-don't-overtake) is STRUCTURAL here: POST requires the rep's own
 * hypothesis; the System's read is generated only AFTER, and builds on it.
 * §3.2/§3.5 — gated on a recorded OUTCOME (no consequence -> no why). §3.1 —
 * the rep's why and the System's why are append-only EVENTS, not columns.
 *
 * GET  -> the latest recorded rep-why + System-why for this session (if any).
 * POST -> record the rep's hypothesis, generate + record the System's why.
 */

const BodySchema = z.object({
  hypothesis: z.string().trim().min(3).max(2000),
});

const REP_KIND = "coach.session_why_recorded";
const SYS_KIND = "coach.session_why_generated";

async function readLatestWhy(sessionId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("events")
    .select("kind, payload, created_at")
    .eq("subject", `sales_session:${sessionId}`)
    .in("kind", [REP_KIND, SYS_KIND])
    .order("created_at", { ascending: false });
  const rows = data ?? [];
  const rep = rows.find((r) => r.kind === REP_KIND);
  const sys = rows.find((r) => r.kind === SYS_KIND);
  return {
    repHypothesis:
      (rep?.payload as { hypothesis?: string } | null)?.hypothesis ?? null,
    systemWhy: (sys?.payload as SessionWhy | null) ?? null,
  };
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const session = await getSession(id); // RLS-scoped read = access check
  if (!session) {
    return NextResponse.json(
      { error: "Session not found or not accessible." },
      { status: 404 }
    );
  }
  return NextResponse.json({
    outcome: session.outcome,
    ...(await readLatestWhy(id)),
  });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req, {
    id: "sales-session-why",
    windowMs: 60_000,
    max: 20,
  });
  if (limited) return limited;

  const { id } = await context.params;
  const body = await readBody(req, BodySchema);
  if (body instanceof NextResponse) return body;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const companyId = (await getCurrentCompanyId()) ?? undefined;
  if (!companyId) {
    return NextResponse.json({ error: "No company context." }, { status: 403 });
  }

  const session = await getSession(id);
  if (!session) {
    return NextResponse.json(
      { error: "Session not found or not accessible." },
      { status: 404 }
    );
  }
  // §3.2/§3.5 gate — no consequence recorded, no why to explain.
  if (!session.outcome) {
    return NextResponse.json(
      { error: "Record the outcome first — the why explains that result." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // §3.3 — record the REP's own hypothesis first (append-only), always.
  await admin.from("events").insert({
    company_id: companyId,
    actor: auth.user.id,
    kind: REP_KIND,
    subject: `sales_session:${id}`,
    payload: { hypothesis: body.hypothesis },
  });

  // THEN the System's read, built on the rep's.
  const segments = await getSessionTranscript(id);
  const systemWhy = await generateSessionWhy({
    companyId,
    outcome: session.outcome,
    repHypothesis: body.hypothesis,
    sessionTitle: session.clientLabel ?? undefined,
    context: session.context,
    segments,
  });

  // Store the System's why only when it has signal (§3.4 — no empty verdict
  // on the record). The rep's hypothesis is always kept regardless.
  if (systemWhy.hasSignal) {
    await admin.from("events").insert({
      company_id: companyId,
      actor: auth.user.id,
      kind: SYS_KIND,
      subject: `sales_session:${id}`,
      payload: systemWhy,
    });
  }

  return NextResponse.json({
    repHypothesis: body.hypothesis,
    systemWhy,
  });
}
