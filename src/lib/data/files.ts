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
  deprecatedAt: string | null;
  deprecatedBy: string | null;
  createdAt: string;
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
    })
    .select("*")
    .single();
  if (error || !data) {
    // eslint-disable-next-line no-console
    console.error(
      `[files.create] failed companyId=${args.companyId} via=${args.uploadedVia} error=${error?.message ?? "no row"}`
    );
    return null;
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

async function hydrate(row: DbRow): Promise<FileRecord | null> {
  const base = mapBase(row);
  const { byFileDept, byFileTask, byFileTag } = await fetchJoinRows([row.id]);
  return attachJoins(base, byFileDept, byFileTask, byFileTag);
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
  let result = rows.map((r) =>
    attachJoins(mapBase(r), byFileDept, byFileTask, byFileTag)
  );
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
  const filePatch: Record<string, unknown> = {};
  if (args.title) filePatch.title = args.title.trim().slice(0, 120);
  if (args.description !== undefined)
    filePatch.description = args.description.trim() || null;
  if (args.accessRole) filePatch.access_role = args.accessRole;
  if (Object.keys(filePatch).length > 0) {
    const { error: e } = await sb
      .from("files")
      .update(filePatch)
      .eq("id", args.fileId);
    if (e) {
      // eslint-disable-next-line no-console
      console.error(`[files.classify] file patch failed: ${e.message}`);
      return null;
    }
  }
  // 2. Replace department join rows.
  await sb.from("file_departments").delete().eq("file_id", args.fileId);
  if (args.departmentIds.length > 0) {
    await sb
      .from("file_departments")
      .insert(
        args.departmentIds.map((dId) => ({
          file_id: args.fileId,
          department_id: dId,
        }))
      );
  }
  // 3. Replace task join rows.
  await sb.from("file_tasks").delete().eq("file_id", args.fileId);
  if (args.taskIds.length > 0) {
    await sb
      .from("file_tasks")
      .insert(args.taskIds.map((tId) => ({ file_id: args.fileId, task_id: tId })));
  }
  // 4. Replace tags.
  await sb.from("file_tags").delete().eq("file_id", args.fileId);
  const normalized = args.tags
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0 && t.length <= 40)
    .slice(0, 20);
  if (normalized.length > 0) {
    await sb
      .from("file_tags")
      .insert(normalized.map((tag) => ({ file_id: args.fileId, tag })));
  }
  return getFile(args.fileId);
}

export async function deprecateFile(id: string): Promise<boolean> {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  const { error } = await sb
    .from("files")
    .update({
      deprecated_at: new Date().toISOString(),
      deprecated_by: auth?.user?.id ?? null,
    })
    .eq("id", id);
  return !error;
}

/**
 * The user's casual-lane upload count today (UTC).
 * Per migration 0057's count_user_casual_uploads_today() RPC,
 * but we re-implement in TS so the API route can show the
 * counter without a DB round-trip when we already have the user.
 */
export async function countUserCasualUploadsToday(
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
    .gte("created_at", startOfDay.toISOString());
  return count ?? 0;
}

export const CASUAL_DAILY_CAP = 3;
