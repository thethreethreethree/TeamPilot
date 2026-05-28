import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import {
  mockTasks,
  mockTeamMembers,
  mockDecisionHistory,
} from "@/lib/mock-data";

/**
 * Seeds the current user's company with the bundled mock data.
 * Safe to call repeatedly — clears the company's existing rows first.
 */
export async function POST() {
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
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  return NextResponse.json({
    seeded: {
      tasks: tasksRows.length,
      team_members: teamRows.length,
      decisions: decisionRows.length,
    },
  });
}
