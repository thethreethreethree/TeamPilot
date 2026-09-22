import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Server-side data layer for departments + per-user assignment.
 *
 * Per CLAUDE.md §3.1: departments are slowly-changing dimension
 * data (org chart). The /departments table is the derived
 * current-state surface; archival uses archived_at, never
 * DELETE. Per §A6: this is pillar 1 (the classification gate)
 * for the Asset System.
 */

export type Department = {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  archivedAt: string | null;
  createdAt: string;
};

type DbRow = {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  archived_at: string | null;
  created_at: string;
};

function map(row: DbRow): Department {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    description: row.description,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
  };
}

export async function listDepartments(opts?: {
  includeArchived?: boolean;
}): Promise<Department[]> {
  const sb = await createClient();
  let q = sb
    .from("departments")
    .select("*")
    .order("name", { ascending: true });
  if (!opts?.includeArchived) {
    q = q.is("archived_at", null);
  }
  const { data, error } = await q;
  // DELIBERATELY AN EMPTY LIST, NOT null — and written down because the line next to it is
  // identical and is a bug.
  //
  // This feeds the department FILTER DROPDOWN. An empty dropdown on a failed read is a degraded
  // control, not a false claim: the user can still see every file, they just cannot narrow by
  // department, and the files page says as much in its own comment ("their failure just empties
  // a dropdown"). Compare `listFiles`, where an empty answer asserts that a task has no
  // documents — a statement about the world rather than about a control.
  //
  // The distinction is the judgement. It should not be something a reader has to reconstruct
  // from two lines that look the same.
  if (error || !data) return [];
  return (data as DbRow[]).map(map);
}

export async function createDepartment(args: {
  name: string;
  description?: string;
}): Promise<Department | null> {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return null;
  const { data: profile } = await sb
    .from("profiles")
    .select("company_id")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (!profile?.company_id) return null;
  const { data, error } = await sb
    .from("departments")
    .insert({
      company_id: profile.company_id,
      name: args.name.trim(),
      description: args.description?.trim() ?? null,
      created_by: auth.user.id,
    })
    .select("*")
    .single();
  if (error || !data) {
    // eslint-disable-next-line no-console
    console.error(
      `[departments.create] failed name=${args.name} error=${error?.message ?? "no row"}`
    );
    return null;
  }
  return map(data as DbRow);
}

export async function renameDepartment(
  id: string,
  name: string,
  description?: string
): Promise<Department | null> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("departments")
    .update({ name: name.trim(), description: description?.trim() ?? null })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) return null;
  return map(data as DbRow);
}

export async function archiveDepartment(id: string): Promise<boolean> {
  const sb = await createClient();
  const { error } = await sb
    .from("departments")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  return !error;
}

export async function unarchiveDepartment(id: string): Promise<boolean> {
  const sb = await createClient();
  const { error } = await sb
    .from("departments")
    .update({ archived_at: null })
    .eq("id", id);
  return !error;
}

export type ProfileDepartment = {
  profileId: string;
  departmentId: string;
  assignedAt: string;
};

/**
 * Which departments a person belongs to, or `null` when the read FAILED.
 *
 * Null rather than an empty list, unlike `listDepartments` above. An empty answer here is a claim
 * about a PERSON — "this person is in no department" — and it is used for scoping, so a failed
 * read returned as `[]` scopes someone to nothing and looks like a correct answer.
 *
 * WHAT THIS AND ITS TWO WRITERS WERE, until 2026-09-22: exported, typed, correct, and called by
 * NOTHING. No surface could put a person in a department, so `profile_departments` was permanently
 * empty — and `autoRoute.ts`'s rule R3 (route an upload to the uploader's own department) read
 * this table and could never fire. Its non-firing was invisible: the rule trace records R3 only
 * when it matched, so a trace without an R3 line reads as "not needed" rather than "inert".
 *
 * `writer:audit` passed the table throughout, because the table HAS writers. It does not ask
 * whether a writer is REACHABLE, and a writer nothing calls is the same fact as no writer, dressed
 * as compliance. That gap is one indirection finer than any gate here looks.
 *
 * The caller is now `POST /api/team/departments`, from the member row on the team page, and
 * `autoRoute.rule3.test.ts` pins that R3 fires once a row exists. Left written down rather than
 * deleted: the shape is worth recognising the next time a table looks complete.
 */
export async function listProfileDepartments(
  profileId?: string
): Promise<ProfileDepartment[] | null> {
  const sb = await createClient();
  let q = sb.from("profile_departments").select("*");
  if (profileId) q = q.eq("profile_id", profileId);
  const { data, error } = await q;
  if (error || !data) return null;
  return (data as Array<{
    profile_id: string;
    department_id: string;
    assigned_at: string;
  }>).map((r) => ({
    profileId: r.profile_id,
    departmentId: r.department_id,
    assignedAt: r.assigned_at,
  }));
}

export async function assignUserToDepartment(args: {
  profileId: string;
  departmentId: string;
}): Promise<boolean> {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return false;
  const { error } = await sb.from("profile_departments").insert({
    profile_id: args.profileId,
    department_id: args.departmentId,
    assigned_by: auth.user.id,
  });
  return !error;
}

export async function removeUserFromDepartment(args: {
  profileId: string;
  departmentId: string;
}): Promise<boolean> {
  const sb = await createClient();
  const { error } = await sb
    .from("profile_departments")
    .delete()
    .eq("profile_id", args.profileId)
    .eq("department_id", args.departmentId);
  return !error;
}
