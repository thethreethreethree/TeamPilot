import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import {
  listProfileDepartments,
  assignUserToDepartment,
  removeUserFromDepartment,
} from "@/lib/data/departments";

/**
 * Which people are in which departments.
 *
 * WHY THIS ROUTE EXISTS AT ALL. `profile_departments` has had a table, RLS, a read and two writers
 * since 0055 — and no caller. So it has been permanently empty, and `autoRoute.ts`'s rule R3
 * (route an upload to the uploader's own department) has never been able to fire. Its silence is
 * invisible by construction: the rule trace records R3 only when it matched, so a trace without an
 * R3 line reads as "not needed" rather than "inert".
 *
 * That is A31 — schema-complete is not built — and `writer:audit` passes the table because it HAS
 * writers. It does not ask whether a writer is reachable, and a writer nothing calls is the same
 * fact as no writer, dressed as compliance.
 *
 * WHO MAY DO THIS IS DECIDED ONCE, IN THE DATABASE. `profile_departments_insert_admin` and
 * `_delete_admin` both require the actor to be an admin of the target's company. This route uses
 * the CALLER-SCOPED client so that policy is the authority (§2.2) rather than a second copy of the
 * rule in TypeScript that can drift from it — which is exactly the failure 0265 spent 47 policies
 * correcting. A side effect worth naming: after 0265 those policies read `admin_roles()`, so a CFO
 * can assign departments without a line here being written for it.
 *
 * The one check the route adds is the tenant pin, because a policy refusal and "no such person"
 * are different answers and only the route can tell them apart.
 */
export const maxDuration = 15;

const Body = z.object({
  memberId: z.string().uuid(),
  departmentIds: z.array(z.string().uuid()).max(50),
});

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "team-departments-list", windowMs: 60_000, max: 120 });
  if (limited) return limited;

  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  /**
   * ONE READ FOR THE WHOLE COMPANY, not one per member. RLS scopes it: the SELECT policy admits a
   * row when the profile belongs to the caller's company, so "every assignment I can see" IS
   * "every assignment in my company".
   *
   * `null` means the read FAILED. Returning `[]` instead would tell the team page that nobody is
   * in any department, which is indistinguishable from the state this route exists to end.
   */
  const assignments = await listProfileDepartments();
  if (assignments === null) {
    return NextResponse.json({ error: "Couldn't load department assignments." }, { status: 500 });
  }

  const byMember: Record<string, string[]> = {};
  for (const a of assignments) {
    (byMember[a.profileId] ??= []).push(a.departmentId);
  }
  return NextResponse.json({ byMember });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "team-departments-set", windowMs: 60_000, max: 60 });
  if (limited) return limited;

  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  // TENANT PIN. The RLS policy already refuses a cross-company write, but a refusal cannot say
  // WHY, and "not found in your company" is the honest answer to an id from another tenant. This
  // read is caller-scoped too, so it cannot see outside the company either.
  const sb = await createClient();
  const { data: target } = await sb
    .from("profiles")
    .select("id")
    .eq("id", body.memberId)
    .eq("company_id", ctx.companyId)
    .maybeSingle();
  if (!target) {
    return NextResponse.json({ error: "Member not found in your company." }, { status: 404 });
  }

  const current = await listProfileDepartments(body.memberId);
  if (current === null) {
    // Without knowing the current set there is no diff to compute, and guessing would either
    // re-insert a row that exists (a unique violation) or delete one the caller never saw.
    return NextResponse.json({ error: "Couldn't read this member's departments." }, { status: 500 });
  }

  const currentIds = new Set(current.map((c) => c.departmentId));
  const wanted = new Set(body.departmentIds);
  const toAdd = [...wanted].filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !wanted.has(id));

  /**
   * A DIFF, NOT A REPLACE-ALL, and the reason is `assigned_by` / `assigned_at`.
   *
   * Those columns record who put this person in this department and when. Deleting and re-inserting
   * every row on every save would rewrite both for the rows that did not change — turning a record
   * of what happened into a record of the last time anyone pressed Save (§3.1).
   */
  const failures: string[] = [];
  for (const departmentId of toAdd) {
    if (!(await assignUserToDepartment({ profileId: body.memberId, departmentId }))) {
      failures.push(departmentId);
    }
  }
  for (const departmentId of toRemove) {
    if (!(await removeUserFromDepartment({ profileId: body.memberId, departmentId }))) {
      failures.push(departmentId);
    }
  }

  /**
   * A PARTIAL SAVE IS REPORTED AS A PARTIAL SAVE.
   *
   * These are several statements, not one transaction, because the writers are per-row. If some
   * succeeded and some did not, the member is in a state the caller did not ask for, and answering
   * `ok` would leave the page showing what was requested rather than what is true. The route
   * returns what actually holds now, read back rather than assumed.
   */
  const after = await listProfileDepartments(body.memberId);
  if (failures.length > 0) {
    // eslint-disable-next-line no-console
    console.error(
      `[team/departments] ${failures.length} of ${toAdd.length + toRemove.length} changes failed for member=${body.memberId}`
    );
    return NextResponse.json(
      {
        error: "Some changes could not be saved.",
        departmentIds: after?.map((a) => a.departmentId) ?? null,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, departmentIds: after?.map((a) => a.departmentId) ?? null });
}
