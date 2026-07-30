import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import {
  mockTasks,
  mockTeamMembers,
  mockDecisionHistory,
} from "@/lib/mock-data";

/**
 * Dev-only seed route — populates the current company with mock fixtures so the
 * UI can be evaluated against realistic-looking state.
 *
 * Per §3.4 ("no fixed day-one behavior") and the 2026-06-02 audit (Tier 1 #4),
 * this route is GATED to non-production environments. In production it returns
 * 403, refusing to insert mock data into a real customer's chain — a customer
 * accidentally calling this would have their brain learn from synthetic events,
 * which is the exact §3.5 ("measurement of consequence") failure mode.
 *
 * To explicitly allow seeding in production (e.g. for a sandbox account), set
 * EXECOS_ALLOW_SEED=true. The setting is logged on use.
 */
export async function POST() {
  const isDev = process.env.NODE_ENV !== "production";
  const explicitlyAllowed = process.env.EXECOS_ALLOW_SEED === "true";
  if (!isDev && !explicitlyAllowed) {
    return NextResponse.json(
      {
        error:
          "Seed route is dev-only. Set EXECOS_ALLOW_SEED=true to override (e.g. for a sandbox tenant). Populating a real company with fixtures violates §3.4.",
      },
      { status: 403 }
    );
  }
  if (explicitlyAllowed) {
    // Make the override visible — operator should see it in logs.
    // eslint-disable-next-line no-console
    console.warn("[/api/seed] EXECOS_ALLOW_SEED=true is set; allowing seed in production");
  }

  if (!supabaseEnabled) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", auth.user.id)
    .maybeSingle();

  const companyId = profile?.company_id;
  if (!companyId) {
    return NextResponse.json(
      { error: "Complete onboarding before seeding data." },
      { status: 400 }
    );
  }

  // Clear existing rows (RLS scopes the deletes to this company).
  await supabase.from("tasks").delete().eq("company_id", companyId);
  await supabase.from("team_members").delete().eq("company_id", companyId);
  await supabase.from("decisions").delete().eq("company_id", companyId);

  const tasksRows = mockTasks.map((t) => ({
    company_id: companyId,
    title: t.title,
    description: t.description,
    department: t.department,
    assignee: t.assignee,
    status: t.status,
    priority: t.priority,
    ai_priority_score: t.aiPriorityScore,
    impact_level: t.impactLevel,
    blocker_reason: t.blockerReason,
    due_date: t.dueDate,
  }));

  const teamRows = mockTeamMembers.map((m) => ({
    company_id: companyId,
    name: m.name,
    role: m.role,
    department: m.department,
    active_tasks: m.activeTasks,
    completed_tasks: m.completedTasks,
    overdue_tasks: m.overdueTasks,
    blocked_tasks: m.blockedTasks,
    workload_level: m.workloadLevel,
    consistency_score: m.consistencyScore,
    performance_score: m.performanceScore,
  }));

  const decisionRows = mockDecisionHistory.map((d) => ({
    company_id: companyId,
    title: d.title,
    outcome: d.outcome,
    execution_status: d.executionStatus,
  }));

  const [tasksRes, teamRes, decRes] = await Promise.all([
    supabase.from("tasks").insert(tasksRows),
    supabase.from("team_members").insert(teamRows),
    supabase.from("decisions").insert(decisionRows),
  ]);

  const firstError = tasksRes.error ?? teamRes.error ?? decRes.error;
  if (firstError) {
    console.error("[seed] failed to seed sample data:", firstError);
    return NextResponse.json({ error: "Couldn't seed sample data." }, { status: 500 });
  }

  return NextResponse.json({
    seeded: {
      tasks: tasksRows.length,
      team_members: teamRows.length,
      decisions: decisionRows.length,
    },
  });
}
