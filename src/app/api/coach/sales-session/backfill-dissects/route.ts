import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionTranscript } from "@/lib/data/salesCoach";
import { runAndStoreDissect } from "@/lib/coach/v5/salesDissect";

/**
 * POST /api/coach/sales-session/backfill-dissects
 *
 * The M3 safety net (founder 2026-06-30: admins must get the complete
 * dissect for EVERY substantive session). Finds Sales Coach sessions that
 * have content (ended/reviewed) but NO coach.dissect_generated event, and
 * regenerates the dissect for a BATCH of them — attributed to the SESSION'S
 * agent (§A18), so Coach Assessment aggregates it under the right person.
 *
 * Manager-gated. Batched (LLM cost + function timeout, §5): processes up to
 * BATCH per call and returns how many remain, so the admin / a cron runs it
 * until remaining = 0. Thin sessions short-circuit before any LLM call
 * (§3.4 — no fabrication) and are simply re-checked next run.
 *
 * Cron-ready: the same POST can be called on a schedule (operator config).
 */
const BATCH = 6;

async function resolve() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return { ok: false as const, status: 401 as const };
  const { data: profile } = await sb
    .from("profiles")
    .select("role, company_id, sales_coach_role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const role = (profile?.role as string | null) ?? null;
  const isCompanyAdmin = role === "CEO" || role === "COO" || role === "admin";
  const isManager = isCompanyAdmin || profile?.sales_coach_role === "admin";
  return {
    ok: true as const,
    companyId: (profile?.company_id as string | null) ?? null,
    isManager,
  };
}

export async function POST() {
  const ctx = await resolve();
  if (!ctx.ok) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!ctx.companyId) {
    return NextResponse.json({ error: "No company context." }, { status: 403 });
  }
  if (!ctx.isManager) {
    return NextResponse.json(
      { error: "Backfill is for admins." },
      { status: 403 }
    );
  }

  const admin = createAdminClient();

  // Sessions with content (ended/reviewed), most recent first.
  const { data: sessionsData, error: sErr } = await admin
    .from("coaching_sessions")
    .select("id, agent_id, client_label, context, status")
    .eq("company_id", ctx.companyId)
    .in("status", ["ended", "reviewed"])
    .order("started_at", { ascending: false })
    .limit(300);
  if (sErr) {
    return NextResponse.json({ error: "Couldn't load sessions." }, { status: 500 });
  }
  const sessions = sessionsData ?? [];

  // Which sessions already have a dissect event?
  const { data: dissectEvents, error: eErr } = await admin
    .from("events")
    .select("subject")
    .eq("company_id", ctx.companyId)
    .eq("kind", "coach.dissect_generated");
  if (eErr) {
    return NextResponse.json({ error: "Couldn't load dissects." }, { status: 500 });
  }
  const dissected = new Set(
    (dissectEvents ?? []).map((e) =>
      String(e.subject ?? "").replace("sales_session:", "")
    )
  );

  const missing = sessions.filter((s) => !dissected.has(s.id as string));
  const batch = missing.slice(0, BATCH);

  let generated = 0;
  let thinOrFailed = 0;
  for (const s of batch) {
    const segments = await getSessionTranscript(s.id as string);
    const dissect = await runAndStoreDissect({
      companyId: ctx.companyId,
      actorId: s.agent_id as string,
      sessionId: s.id as string,
      segments,
      sessionTitle: (s.client_label as string | null) ?? undefined,
      context: s.context as "in_person" | "video",
    }).catch(() => null);
    if (dissect?.hasSignal) generated += 1;
    else thinOrFailed += 1;
  }

  return NextResponse.json({
    missingTotal: missing.length,
    processed: batch.length,
    generated,
    thinOrFailed,
    remaining: Math.max(0, missing.length - batch.length),
  });
}
