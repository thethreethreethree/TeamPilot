import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSalesCoachManager } from "@/lib/coach/v5/skillAccess";
import { runDissectBackfill } from "@/lib/coach/v5/dissectBackfill";
import { rateLimit } from "@/lib/api/rateLimit";

/**
 * POST /api/coach/sales-session/backfill-dissects
 *
 * The M3 safety net (founder 2026-06-30: admins must get the complete
 * dissect for EVERY substantive session). Manager-gated, company-scoped,
 * on-demand ("Generate missing" button). Processes a BATCH per call and
 * returns how many remain, so the admin runs it until remaining = 0.
 *
 * The sweep logic itself lives in runDissectBackfill (§A21 — shared with the
 * all-company cron at /backfill-dissects-cron). This route supplies the
 * auth + the company scope + the manual batch size; the core does the work.
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
  const isManager = isSalesCoachManager({
    role,
    sales_coach_role: (profile?.sales_coach_role as string | null) ?? null,
    company_id: null,
  });
  return {
    ok: true as const,
    companyId: (profile?.company_id as string | null) ?? null,
    isManager,
  };
}

// LLM route: longer serverless budget than Vercel's short default (awaits LLM calls via a lib chain).
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  // Each call fans out up to BATCH (6) LLM dissect calls. Admin-gated below,
  // but a double-fired "Generate missing" button or a client retry loop could
  // still stack overlapping batches — cap per-user so it can't. 10/min lets an
  // admin drain the queue at 60 dissects/min while blocking rapid-fire abuse
  // (§A21 — parity with the 27 sibling coach LLM routes; §3.4 — don't spend on
  // duplicate work a stuck button would trigger).
  const limited = rateLimit(req, {
    id: "coach-backfill-dissects",
    windowMs: 60_000,
    max: 10,
  });
  if (limited) return limited;

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

  try {
    const result = await runDissectBackfill({
      companyId: ctx.companyId,
      cap: BATCH,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[coach/backfill-dissects] failed:", err);
    return NextResponse.json(
      { error: "Backfill failed." },
      { status: 500 }
    );
  }
}
