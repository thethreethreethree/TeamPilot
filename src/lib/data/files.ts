import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Server-side data layer for the Asset System v1 files table.
 *
 * Per CLAUDE.md §3.1: the file is the asset row; interactions
 * with it (upload, view, download, share, cite) emit chain
 * events. This module owns the row CRUD; the events live in the
 * existing events table and are emitted from API routes after
 * the data layer call returns success.
 *
 * Per §A10: uploader always sees own file. The RLS policy in
 * migration 0057 encodes that. This module trusts RLS.
 *
 * Per §A11: System suggests, user decides. The classification
 * suggestions table is written when the AI proposes; the
 * user's final pick lands in files.* via classifyFile().
 */

export type AccessRole = "everyone" | "admins" | "ceo_admins" | "specific_people";
export type ClassificationLane = "classified" | "casual";
export type UploadedVia = "agent_dashboard" | "customer_widget";

export type FileRecord = {
  id: string;
  companyId: string;
  uploaderId: string | null;
  customerSessionToken: string | null;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  originalFilename: string;
  title: string;
  description: string | null;
  accessRole: AccessRole;
  classificationLane: ClassificationLane;
  classifiedAt: string | null;
  uploadedVia: UploadedVia;
  linkedTopicId: string | null;
  linkedConversationId: string | null;
  linkedTaskId: string | null;
  deprecatedAt: string | null;
  deprecatedBy: string | null;
  createdAt: string;
  /** Resolved uploader display name (audit M2 — server-side join so
   *  every card surface shows the name, not "Unknown"). Null for
   *  customer/widget uploads (no uploader) or unresolvable ids. */
  uploaderName?: string | null;
  // Hydrated separately on detail fetch
  departmentIds: string[];
  taskIds: string[];
  tags: string[];
};

type DbRow = {
  id: string;
  company_id: string;
  uploader_id: string | null;
  customer_session_token: string | null;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  original_filename: string;
  title: string;
  description: string | null;
  access_role: AccessRole;
  classification_lane: ClassificationLane;
  classified_at: string | null;
  uploaded_via: UploadedVia;
  linked_topic_id: string | null;
  linked_conversation_id: string | null;
  linked_task_id: string | null;
  deprecated_at: string | null;
  deprecated_by: string | null;
  created_at: string;
};

function mapBase(row: DbRow): Omit<FileRecord, "departmentIds" | "taskIds" | "tags"> {
  return {
    id: row.id,
    companyId: row.company_id,
    uploaderId: row.uploader_id,
    customerSessionToken: row.customer_session_token,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    originalFilename: row.original_filename,
    title: row.title,
    description: row.description,
    accessRole: row.access_role,
    classificationLane: row.classification_lane,
    classifiedAt: row.classified_at,
    uploadedVia: row.uploaded_via,
    linkedTopicId: row.linked_topic_id,
    linkedConversationId: row.linked_conversation_id,
    linkedTaskId: row.linked_task_id,
    deprecatedAt: row.deprecated_at,
    deprecatedBy: row.deprecated_by,
    createdAt: row.created_at,
  };
}

/**
 * Create the file row AFTER the bytes have been uploaded to
 * Supabase Storage. The caller is responsible for the upload.
 * This function only writes the metadata row.
 */
export async function createFileRecord(args: {
  companyId: string;
  uploaderId: string | null;
  customerSessionToken: string | null;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  originalFilename: string;
  title: string;
  description?: string | null;
  accessRole?: AccessRole;
  uploadedVia: UploadedVia;
  linkedTopicId?: string | null;
  linkedConversationId?: string | null;
  linkedTaskId?: string | null;
}): Promise<FileRecord | null> {
  // Use admin client for customer-widget uploads (uploader_id is
  // null and RLS would reject). Agent uploads use the user-scoped
  // client so RLS verifies uploader_id = auth.uid().
  const sb =
    args.uploadedVia === "customer_widget"
      ? createAdminClient()
      : await createClient();
  const { data, error } = await sb
    .from("files")
    .insert({
      company_id: args.companyId,
      uploader_id: args.uploaderId,
      customer_session_token: args.customerSessionToken,
      storage_path: args.storagePath,
      mime_type: args.mimeType,
      size_bytes: args.sizeBytes,
      original_filename: args.originalFilename,
      title: args.title.trim().slice(0, 120),
      description: args.description?.trim() || null,
      access_role: args.accessRole ?? "everyone",
      uploaded_via: args.uploadedVia,
      linked_topic_id: args.linkedTopicId ?? null,
      linked_conversation_id: args.linkedConversationId ?? null,
      linked_task_id: args.linkedTaskId ?? null,
    })
    .select("*")
    .single();
  if (error || !data) {
    const msg = error?.message ?? "no row returned";
    // eslint-disable-next-line no-console
    console.error(
      `[files.create] failed companyId=${args.companyId} via=${args.uploadedVia} error=${msg}`
    );
    // Throw a structured error so the API route can surface the
    // actual Supabase message to the operator. Previous behavior
    // returned null and the route emitted a generic "Failed to
    // write file row after upload" — opaque. Per 2026-06-19
    // founder report ("still failing") the operator needs the
    // real error string to diagnose.
    throw new Error(`files.create: ${msg}`);
  }
  return hydrate(data as DbRow);
}

async function fetchJoinRows(
  fileIds: string[]
): Promise<{
  byFileDept: Map<string, string[]>;
  byFileTask: Map<string, string[]>;
  byFileTag: Map<string, string[]>;
}> {
  const byFileDept = new Map<string, string[]>();
  const byFileTask = new Map<string, string[]>();
  const byFileTag = new Map<string, string[]>();
  if (fileIds.length === 0) return { byFileDept, byFileTask, byFileTag };
  const sb = await createClient();
  const [deps, tasks, tags] = await Promise.all([
    sb.from("file_departments").select("*").in("file_id", fileIds),
    sb.from("file_tasks").select("*").in("file_id", fileIds),
    sb.from("file_tags").select("*").in("file_id", fileIds),
  ]);
  for (const r of (deps.data ?? []) as Array<{ file_id: string; department_id: string }>) {
    const arr = byFileDept.get(r.file_id) ?? [];
    arr.push(r.department_id);
    byFileDept.set(r.file_id, arr);
  }
  for (const r of (tasks.data ?? []) as Array<{ file_id: string; task_id: string }>) {
    const arr = byFileTask.get(r.file_id) ?? [];
    arr.push(r.task_id);
    byFileTask.set(r.file_id, arr);
  }
  for (const r of (tags.data ?? []) as Array<{ file_id: string; tag: string }>) {
    const arr = byFileTag.get(r.file_id) ?? [];
    arr.push(r.tag);
    byFileTag.set(r.file_id, arr);
  }
  return { byFileDept, byFileTask, byFileTag };
}

function attachJoins(
  base: Omit<FileRecord, "departmentIds" | "taskIds" | "tags">,
  byFileDept: Map<string, string[]>,
  byFileTask: Map<string, string[]>,
  byFileTag: Map<string, string[]>
): FileRecord {
  return {
    ...base,
    departmentIds: byFileDept.get(base.id) ?? [],
    taskIds: byFileTask.get(base.id) ?? [],
    tags: byFileTag.get(base.id) ?? [],
  };
}

/**
 * Resolve uploader display names for a set of file rows (audit M2).
 * Server-side so EVERY FileRecord-producing path (listFiles, getFile,
 * createFileRecord) carries the name — the A13 "author the space
 * once" fix, instead of each card surface resolving it client-side
 * (which left the task section showing "Unknown"). RLS-scoped: the
 * caller can only read profiles in their own company, same as the
 * team API. Returns a map of uploader_id -> full_name (or null).
 */
async function fetchUploaderNames(
  rows: DbRow[]
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  const ids = Array.from(
    new Set(rows.map((r) => r.uploader_id).filter((x): x is string => !!x))
  );
  if (ids.length === 0) return out;
  const sb = await createClient();
  const { data } = await sb
    .from("profiles")
    .select("id, full_name")
    .in("id", ids);
  for (const p of (data ?? []) as Array<{
    id: string;
    full_name: string | null;
  }>) {
    out.set(p.id, p.full_name ?? null);
  }
  return out;
}

async function hydrate(row: DbRow): Promise<FileRecord | null> {
  const base = mapBase(row);
  const { byFileDept, byFileTask, byFileTag } = await fetchJoinRows([row.id]);
  const rec = attachJoins(base, byFileDept, byFileTask, byFileTag);
  const names = await fetchUploaderNames([row]);
  rec.uploaderName = row.uploader_id ? names.get(row.uploader_id) ?? null : null;
  return rec;
}

export type ListFilesOpts = {
  search?: string;
  departmentId?: string;
  taskId?: string;
  tag?: string;
  lane?: ClassificationLane;
  uploaderId?: string;
  linkedTopicId?: string;
  linkedConversationId?: string;
  limit?: number;
};

export async function listFiles(opts: ListFilesOpts = {}): Promise<FileRecord[]> {
  const sb = await createClient();
  let q = sb
    .from("files")
    .select("*")
    .is("deprecated_at", null)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 200);
  if (opts.lane) q = q.eq("classification_lane", opts.lane);
  if (opts.uploaderId) q = q.eq("uploader_id", opts.uploaderId);
  if (opts.linkedTopicId) q = q.eq("linked_topic_id", opts.linkedTopicId);
  if (opts.linkedConversationId)
    q = q.eq("linked_conversation_id", opts.linkedConversationId);
  if (opts.search) {
    // ILIKE on title + description. The fts index in 0056 is
    // there for the search companion spec; v1 library uses a
    // simpler ILIKE for now.
    q = q.or(
      `title.ilike.%${opts.search}%,description.ilike.%${opts.search}%`
    );
  }
  const { data, error } = await q;
  if (error || !data) return [];
  const rows = data as DbRow[];
  const ids = rows.map((r) => r.id);
  const { byFileDept, byFileTask, byFileTag } = await fetchJoinRows(ids);
  const names = await fetchUploaderNames(rows);
  let result = rows.map((r) => {
    const rec = attachJoins(mapBase(r), byFileDept, byFileTask, byFileTag);
    rec.uploaderName = r.uploader_id ? names.get(r.uploader_id) ?? null : null;
    return rec;
  });
  // Department/task/tag filters are applied AFTER join hydration
  // because they require the m2m rows. For v1 this is fine; if
  // we hit scale we'll move to a denormalized search column.
  if (opts.departmentId)
    result = result.filter((f) => f.departmentIds.includes(opts.departmentId!));
  if (opts.taskId)
    result = result.filter((f) => f.taskIds.includes(opts.taskId!));
  if (opts.tag) result = result.filter((f) => f.tags.includes(opts.tag!));
  return result;
}

export async function getFile(id: string): Promise<FileRecord | null> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("files")
    .select("*")
    .eq("id", id)
    .is("deprecated_at", null)
    .maybeSingle();
  if (error || !data) return null;
  return hydrate(data as DbRow);
}

/**
 * Replace classification of a file. This OVERWRITES the
 * department/task/tag join rows for the file. Trigger from
 * migration 0056 re-derives classification_lane on each m2m
 * change.
 */
export async function classifyFile(args: {
  fileId: string;
  departmentIds: string[];
  taskIds: string[];
  tags: string[];
  title?: string;
  description?: string;
  accessRole?: AccessRole;
}): Promise<FileRecord | null> {
  const sb = await createClient();
  // 1. Update files table for title/description/access_role.
  //
  // Audit 2026-06-26 (H2): every write below now verifies it
  // actually affected rows / did not error. The prior code did
  // `.update(...)` and never checked rows-affected — an RLS-filtered
  // update (e.g. a non-uploader non-admin) silently touched ZERO
  // rows, no error, and the function returned getFile() (the
  // UNCHANGED file) as "success." Same silent-no-op class as the
  // delete bug. classifyFile now returns null on any unauthorized /
  // failed write so the PATCH route surfaces a real error.
  const filePatch: Record<string, unknown> = {};
  if (args.title) filePatch.title = args.title.trim().slice(0, 120);
  if (args.description !== undefined)
    filePatch.description = args.description.trim() || null;
  if (args.accessRole) filePatch.access_role = args.accessRole;
  if (Object.keys(filePatch).length > 0) {
    const { data: updated, error: e } = await sb
      .from("files")
      .update(filePatch)
      .eq("id", args.fileId)
      .select("id")
      .maybeSingle();
    if (e || !updated) {
      // eslint-disable-next-line no-console
      console.error(
        `[files.classify] file patch failed or affected no row (RLS?): ${
          e?.message ?? "no row"
        }`
      );
      return null;
    }
  }
  // 2. Replace department join rows. Capture errors — an RLS-denied
  //    insert means the caller can't modify this file; fail loudly.
  {
    const { error: delErr } = await sb
      .from("file_departments")
      .delete()
      .eq("file_id", args.fileId);
    if (delErr) return null;
    if (args.departmentIds.length > 0) {
      const { error: insErr } = await sb.from("file_departments").insert(
        args.departmentIds.map((dId) => ({
          file_id: args.fileId,
          department_id: dId,
        }))
      );
      if (insErr) return null;
    }
  }
  // 3. Replace task join rows.
  {
    const { error: delErr } = await sb
      .from("file_tasks")
      .delete()
      .eq("file_id", args.fileId);
    if (delErr) return null;
    if (args.taskIds.length > 0) {
      const { error: insErr } = await sb
        .from("file_tasks")
        .insert(
          args.taskIds.map((tId) => ({ file_id: args.fileId, task_id: tId }))
        );
      if (insErr) return null;
    }
  }
  // 4. Replace tags.
  {
    const { error: delErr } = await sb
      .from("file_tags")
      .delete()
      .eq("file_id", args.fileId);
    if (delErr) return null;
    const normalized = args.tags
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0 && t.length <= 40)
      .slice(0, 20);
    if (normalized.length > 0) {
      const { error: insErr } = await sb
        .from("file_tags")
        .insert(normalized.map((tag) => ({ file_id: args.fileId, tag })));
      if (insErr) return null;
    }
  }
  return getFile(args.fileId);
}

export async function deprecateFile(id: string): Promise<boolean> {
  // Audit 2026-06-26 (L1): harden the rows-affected check. The DELETE
  // route now uses an admin-client path (route handler), so this
  // helper is not on the live delete path — but it previously
  // returned `!error`, which is TRUE even when RLS filtered the
  // update to zero rows. Left as a landmine for any future caller.
  // Now verifies a row was actually updated via .select().
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  const { data: updated, error } = await sb
    .from("files")
    .update({
      deprecated_at: new Date().toISOString(),
      deprecated_by: auth?.user?.id ?? null,
    })
    .eq("id", id)
    .is("deprecated_at", null)
    .select("id")
    .maybeSingle();
  return !error && !!updated;
}

/**
 * The user's PURPOSELESS casual-upload count today (UTC).
 *
 * Audit 2026-06-26 (H1): the casual cap exists to limit uploads
 * "without a designated purpose" — NOT every casual-lane file. A
 * file linked to a topic / conversation / task has a designated
 * purpose by the cap's own wording, so it must NOT count against
 * the cap. This is the uniform rule across every upload surface:
 * only a file that is casual-lane AND has no context link is
 * "purposeless" and counted.
 *
 * (Renamed from countUserCasualUploadsToday — the old name implied
 * all casual files counted, which was the inconsistency H1 names.)
 */
export async function countPurposelessUploadsToday(
  userId: string
): Promise<number> {
  const sb = await createClient();
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { count } = await sb
    .from("files")
    .select("id", { count: "exact", head: true })
    .eq("uploader_id", userId)
    .eq("classification_lane", "casual")
    .is("deprecated_at", null)
    .is("linked_topic_id", null)
    .is("linked_conversation_id", null)
    .is("linked_task_id", null)
    .gte("created_at", startOfDay.toISOString());
  return count ?? 0;
}

export const CASUAL_DAILY_CAP = 3;
