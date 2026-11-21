import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * RSS Phase 7 — practice scenarios and assignments (Gong F17.3, F17.10, F17.11; migration 0282).
 *
 * Status is DERIVED, never stored: from the assignment's current due date (latest training_due_changes row, else the
 * original) and its attempts. One function decides it (assignmentStatus) for the rep's list, the manager's table
 * and the bell — §2.2.
 */
export const DIFFICULTIES = ["easy", "intermediate", "advanced"] as const;
export const SCENARIO_CHANNELS = ["in_person", "video", "phone"] as const;

export type Attempt = { score: number; applied: boolean; passed: boolean | null; createdAt: string };
export type AssignmentState = "due" | "overdue" | "attempted" | "passed" | "not_passed_yet";

export function currentDue(original: string, changes: Array<{ due_at: string }>): string {
  return changes.at(-1)?.due_at ?? original;
}

/** passed = score ≥ pass mark; null when the scenario has no mark. Pure. */
export function passedFor(score: number, passScore: number | null): boolean | null {
  return passScore === null ? null : score >= passScore;
}

export function assignmentStatus(args: { dueAt: string; attempts: Attempt[]; passScore: number | null; now?: Date }): { state: AssignmentState; best: number | null } {
  const best = args.attempts.length ? Math.max(...args.attempts.map((a) => a.score)) : null;
  if (args.attempts.length > 0) {
    if (args.passScore === null) return { state: "attempted", best };
    return { state: args.attempts.some((a) => a.passed) ? "passed" : "not_passed_yet", best };
  }
  const now = (args.now ?? new Date()).getTime();
  return { state: Date.parse(args.dueAt) < now ? "overdue" : "due", best };
}

export type ScenarioRow = {
  id: string; title: string; persona: string; situation: string; focus: string; channel: string;
  difficulty: string; length_min: number; pass_score: number | null; source_session_id: string | null; retired_at: string | null;
};

/**
 * The assignment a rep is practising, with its scenario — or null when it is not theirs (or not in the company).
 * Used by the role-play route so the SCORE it records belongs to the right rep and is scored against the scenario's
 * own skill, not one the client sent. Service-role read, company-pinned.
 */
export async function assignmentForRep(
  admin: SupabaseClient,
  companyId: string,
  repId: string,
  assignmentId: string,
): Promise<{ id: string; assignedBy: string; scenario: ScenarioRow } | null> {
  const { data: a } = await admin
    .from("training_assignments")
    .select("id, assigned_by, scenario_id")
    .eq("company_id", companyId)
    .eq("rep_id", repId)
    .eq("id", assignmentId)
    .maybeSingle();
  if (!a) return null;
  const { data: s } = await admin
    .from("training_scenarios")
    .select("id, title, persona, situation, focus, channel, difficulty, length_min, pass_score, source_session_id, retired_at")
    .eq("company_id", companyId)
    .eq("id", a.scenario_id)
    .maybeSingle();
  if (!s) return null;
  return { id: String(a.id), assignedBy: String(a.assigned_by), scenario: s as ScenarioRow };
}
