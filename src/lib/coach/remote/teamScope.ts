import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdminRole } from "@/lib/roles";
import { isSalesCoachManager } from "@/lib/coach/v5/skillAccess";
import { reportsOf, TreeError, type Person } from "@/lib/coach/remote/access";

/**
 * "Show one manager's team" on the coaching screens (2026-11-26; Gong ledger F10.9 / F16.6: switch to another
 * manager's team). A `team=<manager id>` parameter NARROWS a coaching read to that manager and everyone below them —
 * it never widens it: each route still applies the caller's own access (reporting tree, hidden calls) first, and the
 * caller must be allowed to see the chosen manager (the route asks treeAllowsRep before calling this).
 */
export async function companyPeople(admin: SupabaseClient, companyId: string): Promise<Person[]> {
  const { data, error } = await admin.from("profiles").select("id, company_id, manager_id, role, sales_coach_role").eq("company_id", companyId);
  if (error) throw new Error(`team read failed: ${error.message}`);
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    companyId: String(r.company_id),
    managerId: (r.manager_id as string | null) ?? null,
    isCompanyAdmin: isAdminRole((r.role as string | null) ?? null),
    isSalesCoachManager: isSalesCoachManager({ role: (r.role as string | null) ?? null, sales_coach_role: (r.sales_coach_role as string | null) ?? null, company_id: String(r.company_id) }),
  }));
}

/** The chosen manager and everyone below them. Throws TreeError on a reporting loop. */
export function teamMembers(managerId: string, people: Person[]): Set<string> {
  return new Set([managerId, ...reportsOf(managerId, people)]);
}

/** Everyone who has at least one report, with their team size (themselves + everyone below). Pure. */
export function teamsIn(people: Person[]): Array<{ id: string; size: number }> {
  const managers = [...new Set(people.map((p) => p.managerId).filter((x): x is string => !!x))].filter((id) => people.some((p) => p.id === id));
  const out: Array<{ id: string; size: number }> = [];
  for (const id of managers) {
    try {
      out.push({ id, size: teamMembers(id, people).size });
    } catch (e) {
      if (!(e instanceof TreeError)) throw e; // a loop: that "team" isn't offered
    }
  }
  return out;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Read `team` from a request: null = no narrowing; a Set = narrow to those people; an error = refuse (400/404/500).
 * `allows(managerId)` is the caller's tree check (treeAllowsRep). `admin` is only called when a team is asked for.
 */
export async function teamFromRequest(
  req: Request,
  admin: () => SupabaseClient,
  companyId: string,
  allows: (managerId: string) => Promise<boolean>,
): Promise<{ ok: true; members: Set<string> | null } | { ok: false; status: number; error: string }> {
  const team = new URL(req.url).searchParams.get("team");
  if (!team) return { ok: true, members: null };
  if (!UUID.test(team)) return { ok: false, status: 400, error: "Unknown team." };
  if (!(await allows(team))) return { ok: false, status: 404, error: "Team not found." };
  try {
    const people = await companyPeople(admin(), companyId);
    if (!people.some((p) => p.id === team)) return { ok: false, status: 404, error: "Team not found." };
    return { ok: true, members: teamMembers(team, people) };
  } catch (e) {
    console.error(`[teamScope] failed: ${e instanceof Error ? e.message : String(e)}`);
    return { ok: false, status: 500, error: "Couldn't load that team." };
  }
}
