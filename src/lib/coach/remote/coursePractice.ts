import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPagedResult } from "@/lib/supabase/paginate";
import { assignmentStatus, currentDue, type Attempt, type AssignmentState } from "./training";

/**
 * Practice steps in training courses (2026-11-26, Gong F17.1; migration 0357). A practice step IS one of the company's
 * practice scenarios: giving a rep the course gives them that scenario (a training_assignments row, 0282, with the
 * course's due date), and the step is done when that practice counts as done — assignmentStatus decides it, the same
 * verdict the practice list and the manager's table use (§2.2). Service-role reads, company-pinned; callers have
 * already decided whose data this is (the rep themself, or reps the reporting tree allows).
 */
const CHUNK = 150;
/** Two .in() lists in one request (reps × scenarios): the scenario list is cut smaller so the URL stays short (review). */
const SCEN_CHUNK = 40;

/** True when every id is a live scenario of this company; null when the read failed. */
export async function scenariosUsable(admin: SupabaseClient, companyId: string, ids: string[]): Promise<boolean | null> {
  const want = [...new Set(ids)];
  if (!want.length) return true;
  const found = new Set<string>();
  for (let i = 0; i < want.length; i += CHUNK) {
    const { data, error } = await admin.from("training_scenarios").select("id, retired_at").eq("company_id", companyId).in("id", want.slice(i, i + CHUNK));
    if (error) return null;
    for (const s of (data ?? []) as Array<{ id: string; retired_at: string | null }>) if (!s.retired_at) found.add(String(s.id));
  }
  return want.every((id) => found.has(id));
}

/**
 * Gives each rep each scenario they don't already have, due when their course is due, assigned BY whoever gave them the
 * course (that manager's reporting tree was checked when they did). Existing ones are left as they
 * are (a rep's own due date and attempts stand). Returns "ok", "conflict" (someone assigned one at the same moment) or
 * "failed". A plain insert of the missing pairs: the table has an UPDATE rule, so Postgres refuses ON CONFLICT (0282).
 */
export async function assignPractice(
  admin: SupabaseClient,
  companyId: string,
  args: { scenarioIds: string[]; reps: Array<{ repId: string; dueAt: string; by: string }> },
): Promise<"ok" | "conflict" | "failed"> {
  // A retired scenario gets no NEW assignments (0282) — not through a course either; reps who have it keep it.
  const live = new Set<string>();
  const asked = [...new Set(args.scenarioIds)];
  for (let i = 0; i < asked.length; i += CHUNK) {
    const { data, error } = await admin.from("training_scenarios").select("id, retired_at").eq("company_id", companyId).in("id", asked.slice(i, i + CHUNK));
    if (error) return "failed";
    for (const s of (data ?? []) as Array<{ id: string; retired_at: string | null }>) if (!s.retired_at) live.add(String(s.id));
  }
  const scenarioIds = asked.filter((id) => live.has(id));
  if (!scenarioIds.length || !args.reps.length) return "ok";
  const repIds = [...new Set(args.reps.map((r) => r.repId))];
  const had = new Set<string>();
  for (let i = 0; i < repIds.length; i += CHUNK) {
    for (let k = 0; k < scenarioIds.length; k += SCEN_CHUNK) {
      const { data, error } = await fetchAllPagedResult<{ rep_id: string; scenario_id: string; id: string }>(
        (from, to) => admin.from("training_assignments").select("rep_id, scenario_id, id").eq("company_id", companyId).in("rep_id", repIds.slice(i, i + CHUNK)).in("scenario_id", scenarioIds.slice(k, k + SCEN_CHUNK)).order("id", { ascending: true }).range(from, to),
        { label: "course practice existing", maxRows: 100_000 },
      );
      if (error) return "failed";
      for (const r of data ?? []) had.add(`${r.rep_id}|${r.scenario_id}`);
    }
  }
  const fresh = args.reps.flatMap((r) => scenarioIds.filter((s) => !had.has(`${r.repId}|${s}`)).map((s) => ({ company_id: companyId, scenario_id: s, rep_id: r.repId, assigned_by: r.by, due_at: r.dueAt })));
  for (let i = 0; i < fresh.length; i += 500) {
    const { error } = await admin.from("training_assignments").insert(fresh.slice(i, i + 500));
    if (error?.code === "23505") return "conflict";
    if (error) return "failed";
  }
  return "ok";
}

export type PracticeState = { assignmentId: string; state: AssignmentState; done: boolean };

/** Which of these scenarios are retired (review 2026-11-26: a retired practice can't be given to a new taker). */
export async function retiredScenarios(admin: SupabaseClient, companyId: string, scenarioIds: string[]): Promise<Set<string> | null> {
  const out = new Set<string>();
  const ids = [...new Set(scenarioIds)];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await admin.from("training_scenarios").select("id, retired_at").eq("company_id", companyId).in("id", ids.slice(i, i + CHUNK));
    if (error) return null;
    for (const s of (data ?? []) as Array<{ id: string; retired_at: string | null }>) if (s.retired_at) out.add(String(s.id));
  }
  return out;
}

/**
 * A course's due date moved: each of this rep's practices for the course that isn't done yet moves with it, as a
 * training_due_changes row (0282, §3.1) — so the practice list never shows "overdue" for a course that isn't (review).
 * A practice already done keeps its date. Returns false when a read or write failed.
 */
export async function movePracticeDue(admin: SupabaseClient, companyId: string, args: { repId: string; scenarioIds: string[]; dueAt: string; by: string }): Promise<boolean> {
  if (!args.scenarioIds.length) return true;
  const states = await practiceStates(admin, companyId, [args.repId], args.scenarioIds);
  if (!states) return false;
  const rows = [...states.values()].filter((p) => !p.done).map((p) => ({ company_id: companyId, assignment_id: p.assignmentId, due_at: args.dueAt, changed_by: args.by }));
  if (!rows.length) return true;
  const { error } = await admin.from("training_due_changes").insert(rows);
  return !error;
}

/**
 * For each rep, their practice of each scenario: the assignment to open and its state. Key `${repId}|${scenarioId}`.
 * A practice counts as done when it is "attempted" (no pass mark) or "passed". Null when a read failed.
 */
export async function practiceStates(admin: SupabaseClient, companyId: string, repIds: string[], scenarioIds: string[]): Promise<Map<string, PracticeState> | null> {
  const out = new Map<string, PracticeState>();
  const reps = [...new Set(repIds)];
  const scen = [...new Set(scenarioIds)];
  if (!reps.length || !scen.length) return out;
  const rows: Array<{ id: string; rep_id: string; scenario_id: string; due_at: string }> = [];
  for (let i = 0; i < reps.length; i += CHUNK) {
    for (let k = 0; k < scen.length; k += SCEN_CHUNK) {
      const { data, error } = await fetchAllPagedResult<{ id: string; rep_id: string; scenario_id: string; due_at: string }>(
        (from, to) => admin.from("training_assignments").select("id, rep_id, scenario_id, due_at").eq("company_id", companyId).in("rep_id", reps.slice(i, i + CHUNK)).in("scenario_id", scen.slice(k, k + SCEN_CHUNK)).order("id", { ascending: true }).range(from, to),
        { label: "course practice", maxRows: 100_000 },
      );
      if (error) return null;
      rows.push(...(data ?? []));
    }
  }
  if (!rows.length) return out;
  const passOf = new Map<string, number | null>();
  for (let i = 0; i < scen.length; i += CHUNK) {
    const { data, error } = await admin.from("training_scenarios").select("id, pass_score").eq("company_id", companyId).in("id", scen.slice(i, i + CHUNK));
    if (error) return null;
    for (const s of (data ?? []) as Array<{ id: string; pass_score: number | null }>) passOf.set(String(s.id), s.pass_score);
  }
  const ids = rows.map((r) => r.id);
  const changes = new Map<string, Array<{ due_at: string }>>();
  const attempts = new Map<string, Attempt[]>();
  for (let i = 0; i < ids.length; i += CHUNK) {
    const part = ids.slice(i, i + CHUNK);
    const [c, a] = await Promise.all([
      fetchAllPagedResult<{ assignment_id: string; due_at: string; id: number }>(
        (from, to) => admin.from("training_due_changes").select("assignment_id, due_at, id").eq("company_id", companyId).in("assignment_id", part).order("id", { ascending: true }).range(from, to),
        { label: "course practice due changes", maxRows: 100_000 },
      ),
      fetchAllPagedResult<{ assignment_id: string; score: number; applied: boolean; passed: boolean | null; created_at: string; id: number }>(
        (from, to) => admin.from("training_attempts").select("assignment_id, score, applied, passed, created_at, id").eq("company_id", companyId).in("assignment_id", part).order("id", { ascending: true }).range(from, to),
        { label: "course practice attempts", maxRows: 100_000 },
      ),
    ]);
    if (c.error || a.error) return null;
    for (const x of c.data ?? []) changes.set(x.assignment_id, [...(changes.get(x.assignment_id) ?? []), x]);
    for (const x of a.data ?? []) attempts.set(x.assignment_id, [...(attempts.get(x.assignment_id) ?? []), { score: x.score, applied: x.applied, passed: x.passed, createdAt: x.created_at }]);
  }
  for (const r of rows) {
    const { state } = assignmentStatus({ dueAt: currentDue(r.due_at, changes.get(r.id) ?? []), attempts: attempts.get(r.id) ?? [], passScore: passOf.get(String(r.scenario_id)) ?? null });
    out.set(`${r.rep_id}|${r.scenario_id}`, { assignmentId: r.id, state, done: state === "attempted" || state === "passed" });
  }
  return out;
}
