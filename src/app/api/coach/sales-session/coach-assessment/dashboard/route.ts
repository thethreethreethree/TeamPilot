import { NextRequest, NextResponse } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { getLatestTeamBrief } from "@/lib/coach/v5/teamTrainingBrief";
import { readTeamAssessment } from "@/lib/coach/assessment/readTeamAssessment";
import type { BriefTheme } from "@/lib/coach/assessment/teamAssessment";
import { readReviewFlags } from "@/lib/coach/assessment/reviewFlags";

/**
 * GET /api/coach/sales-session/coach-assessment/dashboard?period=day|week|month|all
 *
 * The Coach Assessment manager dashboard (guide Step 3). One period toggle governs the whole
 * page, which is the guide's own framing: *"Everything on the page follows one Day / Week /
 * Month / All time toggle in the header."*
 *
 * MANAGER-GATED, and here the gate is real rather than advisory. Pattern Interrupt's team scope
 * could be left to RLS because a rep asking for the team simply gets themselves. This page is
 * different: it exists to compare reps, and the name lookup below is a cross-person read. So the
 * manager check decides whether the route answers at all.
 *
 * DEGRADES RATHER THAN FAILS on the brief. The priority cards are the only part that needs it,
 * and a brief that has not been generated yet is the normal state of a new company — the page
 * renders its team numbers and says the cards need a brief, instead of 500-ing on a section a
 * manager did not come for.
 */
export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "coach-assessment-dashboard", windowMs: 60_000, max: 60 });
  if (limited) return limited;

  const manager = await requireSalesCoachManager(req);
  if (!manager) {
    return NextResponse.json({ error: "Managers only." }, { status: 403 });
  }

  const supabase = callerScopedDb(req) ?? (await createClient());
  const raw = req.nextUrl.searchParams.get("period") ?? "week";
  const period = (["day", "week", "month", "all"] as const).includes(raw as never)
    ? (raw as "day" | "week" | "month" | "all")
    : "week";

  const from = periodStart(period, new Date());

  // Names and the existing coaching grade, for the reps table. Scoped to this company and read
  // with the service role because a manager must see reps who have not scored a pitch yet —
  // exactly the people the board is for — and those reps have no row the caller-scoped read
  // would return.
  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("company_id", manager.companyId)
    .eq("status", "active");

  const nameByRep = new Map<string, string>();
  for (const p of profiles ?? []) {
    if (p.full_name) nameByRep.set(String(p.id), String(p.full_name));
  }

  // The brief, for the three priority cards and each rep's one focus. Best-effort.
  let themes: BriefTheme[] = [];
  const focusByName = new Map<string, string>();
  let briefGeneratedAt: string | null = null;
  try {
    const cached = await getLatestTeamBrief(manager.companyId);
    if (cached && cached.result.ok) {
      themes = cached.result.brief.themes.map((t) => ({ title: t.title, why: t.why }));
      for (const r of cached.result.brief.repFocus) focusByName.set(r.rep, r.focus);
      briefGeneratedAt = cached.generatedAt;
    }
  } catch (e) {
    console.error(
      `[coach-assessment-dashboard] brief read failed company=${manager.companyId}: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  const assessment = await readTeamAssessment(
    {
      companyId: manager.companyId,
      ...(from ? { from } : {}),
      themes,
      focusByName,
      nameByRep,
    },
    supabase
  );

  /**
   * The rubric's one escalated violation — "Needs your attention", item one.
   *
   * BEST-EFFORT, and distinguishable from empty. `null` means the read failed and the board says
   * so; `[]` means a human has dealt with every flag, which is a finding worth showing. Drawing a
   * failed read as an empty queue would tell a manager nobody has been rude this week, which is
   * the one wrong answer on this card.
   */
  let reviewFlags = null;
  try {
    reviewFlags = await readReviewFlags(
      { companyId: manager.companyId, nameByRep },
      supabase
    );
  } catch (e) {
    console.error(
      `[coach-assessment-dashboard] review flags failed company=${manager.companyId}: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  if (assessment === null) {
    // Never an empty team. A dashboard of zeros about a week the team worked is the confident-zero
    // this codebase has an invariant against, and on this page it would read as a performance
    // collapse rather than as a failed read.
    return NextResponse.json({ error: "Could not load the team's figures." }, { status: 500 });
  }

  // Spread FIRST, then the toggle — `assessment.period` is the {from,to} window and this one is
  // the toggle's name. Two different things that were briefly one key, which typescript caught.
  const { period: window, ...rest } = assessment;
  return NextResponse.json({
    ...rest,
    period,
    window,
    /** Null when no brief exists yet — the surface says so rather than drawing three empty cards. */
    briefGeneratedAt,
    /**
     * Rude-or-dismissive flags awaiting a human. `null` = the read failed, `[]` = none outstanding.
     * The board must keep those apart; they render identically and mean opposite things.
     */
    reviewFlags,
  });
}

/**
 * Period start, matching the rep boards' toggle so a manager and a rep mean the same "this week".
 *
 * Undefined for "all time", which has no start — and `readPitchPeriod` treats an absent `from` as
 * unbounded, so the two agree without a special case.
 */
function periodStart(period: "day" | "week" | "month" | "all", now: Date): string | undefined {
  if (period === "all") return undefined;
  const days = { day: 1, week: 7, month: 30 }[period];
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}
