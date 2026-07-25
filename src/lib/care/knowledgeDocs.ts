/**
 * ACMS (Adaptive Customer Management System) — data layer for client-uploaded
 * knowledge documents. See migration 0193 for the schema + the append-only/
 * immutability rationale.
 *
 * Founder-locked decisions (2026-07-25):
 *   ① KNOWLEDGE ONLY — this is DATA the customer-facing AI answers from, never
 *      behavior. The fencing lives in src/lib/care/prompt.ts; this module only
 *      stores and retrieves.
 *   ② APPEND-ONLY VERSIONS — each upload is a new immutable version; "current"
 *      is the latest version per company; retract = append a retracted version.
 *
 * Two access paths, on purpose:
 *   - Agent CRUD (upload / list) → RLS server client (createServerClient): the
 *     signed-in admin's session, RLS scopes to their company.
 *   - Reply-path read (getActiveKnowledgeForCompany) → service-role client: the
 *     customer message / inbound email path has NO agent session, so it reads
 *     under service-role (RLS bypass by design, same pattern as the config load).
 */

import { createHash } from "node:crypto";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const TABLE = "care_knowledge_documents";

export type KnowledgeVersion = {
  id: string;
  companyId: string;
  version: number;
  title: string;
  filename: string | null;
  byteSize: number;
  status: "active" | "retracted";
  createdAt: string;
};

function mapRow(row: Record<string, unknown>): KnowledgeVersion {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    version: row.version as number,
    title: (row.title as string) ?? "",
    filename: (row.filename as string | null) ?? null,
    byteSize: (row.byte_size as number) ?? 0,
    status: (row.status as "active" | "retracted") ?? "active",
    createdAt: row.created_at as string,
  };
}

/**
 * List every version for a company (newest first), metadata only — content is
 * omitted from the list on purpose (it can be large; the UI shows metadata +
 * previews the current one). RLS-scoped to the caller's company.
 */
export async function listKnowledgeVersions(): Promise<KnowledgeVersion[]> {
  const sb = await createServerClient();
  const { data } = await sb
    .from(TABLE)
    .select("id, company_id, version, title, filename, byte_size, status, created_at")
    .order("version", { ascending: false });
  return (data ?? []).map(mapRow);
}

/**
 * The current knowledge CONTENT for a company (RLS-scoped), for the settings
 * preview. Returns the latest version's content, or null if the latest is a
 * retraction (knowledge turned off) or none exists.
 */
export async function getCurrentKnowledgePreview(): Promise<
  { version: number; title: string; content: string } | null
> {
  const sb = await createServerClient();
  const { data } = await sb
    .from(TABLE)
    .select("version, title, content, status")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data || data.status !== "active") return null;
  return {
    version: data.version as number,
    title: (data.title as string) ?? "",
    content: (data.content as string) ?? "",
  };
}

async function nextVersion(
  sb: Awaited<ReturnType<typeof createServerClient>>,
  companyId: string
): Promise<number> {
  const { data } = await sb
    .from(TABLE)
    .select("version")
    .eq("company_id", companyId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  return ((data?.version as number | undefined) ?? 0) + 1;
}

export type AddResult =
  | { ok: true; version: KnowledgeVersion }
  | { ok: false; error: string };

/**
 * Append a new ACMS knowledge version from an uploaded .md. Content is stored
 * verbatim (fenced as untrusted data at the prompt layer, never here). Computes
 * the next per-company version; the unique(company_id, version) constraint makes
 * a concurrent double-upload fail honestly (23505) rather than silently collide.
 */
export async function addKnowledgeVersion(args: {
  companyId: string;
  title: string;
  filename: string | null;
  content: string;
  createdBy: string;
}): Promise<AddResult> {
  const content = args.content;
  if (!content.trim()) return { ok: false, error: "The file is empty." };
  if (content.length > 200000) {
    return { ok: false, error: "File too large (200k character limit)." };
  }
  const sb = await createServerClient();
  const version = await nextVersion(sb, args.companyId);
  const content_hash = createHash("sha256").update(content).digest("hex");
  const byte_size = Buffer.byteLength(content, "utf8");
  const { data, error } = await sb
    .from(TABLE)
    .insert({
      company_id: args.companyId,
      version,
      title: args.title.slice(0, 200),
      filename: args.filename ? args.filename.slice(0, 260) : null,
      content,
      content_hash,
      byte_size,
      status: "active",
      created_by: args.createdBy,
    })
    .select("id, company_id, version, title, filename, byte_size, status, created_at")
    .single();
  if (error || !data) {
    if (error?.code === "23505") {
      return { ok: false, error: "Another upload just landed — try again." };
    }
    return { ok: false, error: error?.message ?? "Couldn't save the document." };
  }
  return { ok: true, version: mapRow(data) };
}

/**
 * Turn knowledge OFF by appending a retraction version (append-only — we never
 * delete or edit prior versions). The reply path then reads no active knowledge.
 */
export async function retractKnowledge(args: {
  companyId: string;
  createdBy: string;
}): Promise<AddResult> {
  const sb = await createServerClient();
  const version = await nextVersion(sb, args.companyId);
  const marker = "(knowledge retracted)";
  const content_hash = createHash("sha256").update(marker).digest("hex");
  const { data, error } = await sb
    .from(TABLE)
    .insert({
      company_id: args.companyId,
      version,
      title: "Knowledge retracted",
      filename: null,
      content: marker,
      content_hash,
      byte_size: Buffer.byteLength(marker, "utf8"),
      status: "retracted",
      created_by: args.createdBy,
    })
    .select("id, company_id, version, title, filename, byte_size, status, created_at")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Couldn't retract." };
  }
  return { ok: true, version: mapRow(data) };
}

/**
 * The CURRENT active knowledge content for a company, for the SESSION-LESS reply
 * path (customer message / inbound email). Service-role read. Returns null when
 * the latest version is a retraction or none exists — so the caller injects
 * nothing rather than stale/retracted content.
 */
export async function getActiveKnowledgeForCompany(
  companyId: string
): Promise<string | null> {
  const sb = createAdminClient();
  const { data } = await sb
    .from(TABLE)
    .select("content, status")
    .eq("company_id", companyId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data || data.status !== "active") return null;
  const content = (data.content as string) ?? "";
  return content.trim() ? content : null;
}
