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

export async function listProfileDepartments(
  profileId?: string
): Promise<ProfileDepartment[]> {
  const sb = await createClient();
  let q = sb.from("profile_departments").select("*");
  if (profileId) q = q.eq("profile_id", profileId);
  const { data, error } = await q;
  if (error || !data) return [];
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
