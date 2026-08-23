import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Prep-up data layer (Team-Sync / Meeting Coach, founder 2026-08-22). Pre-meeting context (goal + must-discuss
 * topics + documents) that makes the live coach agenda-aware and sharpens the Dissect. Owner-scoped writes go
 * through the request client (RLS enforces created_by = auth.uid()); the brain-side read (by session_id) uses
 * the admin client because it runs in the cue path after the session is already owner-verified.
 *
 * INV22 (never dress a failure as empty data): the user-facing reads (getMeetingPrep, listPrepDocuments) THROW on
 * a genuine DB error so the route 500s honestly — null/[] is reserved for a real no-row. The brain-side reads
 * (getMeetingPrepBySession, getPrepDocContext) run in the best-effort cue path, so they LOG the error + degrade to
 * agenda-less coaching rather than break the cue — logged, never silently swallowed.
 */

export type PrepTopic = { id: string; text: string; covered: boolean };
export interface MeetingPrep {
  id: string;
  companyId: string;
  createdBy: string;
  goal: string;
  topics: PrepTopic[];
  status: "draft" | "active" | "done";
  sessionId: string | null;
}
export interface PrepDocument {
  id: string;
  filename: string;
  kind: "image" | "text" | "pdf";
  note: string;
  extractedText: string;
  storagePath: string;
}

type PrepRow = {
  id: string;
  company_id: string;
  created_by: string;
  goal: string | null;
  topics: unknown;
  status: string | null;
  session_id: string | null;
};
function mapPrep(row: PrepRow): MeetingPrep {
  const topics = Array.isArray(row.topics)
    ? (row.topics as unknown[]).filter((t): t is PrepTopic => !!t && typeof (t as PrepTopic).text === "string")
    : [];
  return {
    id: row.id,
    companyId: row.company_id,
    createdBy: row.created_by,
    goal: row.goal ?? "",
    topics,
    status: (row.status as MeetingPrep["status"]) ?? "draft",
    sessionId: row.session_id,
  };
}

/** Create a draft prep for the current facilitator. */
export async function createMeetingPrep(args: { companyId: string }): Promise<MeetingPrep | null> {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return null;
  const { data, error } = await sb
    .from("meeting_preps")
    .insert({ company_id: args.companyId, created_by: auth.user.id })
    .select("*")
    .single();
  if (error || !data) return null;
  return mapPrep(data as PrepRow);
}

/** Owner-scoped read (RLS). Throws on a GENUINE DB error so the route can 500 honestly; null is reserved for a
 *  real no-row (not found / not the owner) — collapsing an error to null told the user their prep was deleted
 *  when it was a transient failure (audit: error-as-no-data / INV22, mirrors getSession). */
export async function getMeetingPrep(prepId: string): Promise<MeetingPrep | null> {
  const sb = await createClient();
  const { data, error } = await sb.from("meeting_preps").select("*").eq("id", prepId).maybeSingle();
  if (error) throw new Error(`getMeetingPrep failed: ${error.message}`);
  if (!data) return null;
  return mapPrep(data as PrepRow);
}

/** Update the goal and/or the topic list (owner-scoped via RLS). Returns the updated prep or null on failure. */
export async function updateMeetingPrep(args: {
  prepId: string;
  goal?: string;
  topics?: PrepTopic[];
}): Promise<MeetingPrep | null> {
  const sb = await createClient();
  const patch: Record<string, unknown> = {};
  if (args.goal !== undefined) patch.goal = args.goal;
  if (args.topics !== undefined) patch.topics = args.topics;
  if (Object.keys(patch).length === 0) return getMeetingPrep(args.prepId);
  const { data, error } = await sb.from("meeting_preps").update(patch).eq("id", args.prepId).select("*").maybeSingle();
  if (error || !data) return null;
  return mapPrep(data as PrepRow);
}

/** Attach an uploaded + extracted document to a prep (owner-scoped via RLS). */
export async function addPrepDocument(args: {
  prepId: string;
  companyId: string;
  storagePath: string;
  filename: string;
  kind: PrepDocument["kind"];
  note: string;
  extractedText: string;
}): Promise<PrepDocument | null> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("meeting_prep_documents")
    .insert({
      prep_id: args.prepId,
      company_id: args.companyId,
      storage_path: args.storagePath,
      filename: args.filename,
      kind: args.kind,
      note: args.note,
      extracted_text: args.extractedText,
    })
    .select("id, filename, kind, note, extracted_text, storage_path")
    .single();
  if (error || !data) return null;
  const r = data as { id: string; filename: string; kind: PrepDocument["kind"]; note: string; extracted_text: string; storage_path: string };
  return { id: r.id, filename: r.filename, kind: r.kind, note: r.note, extractedText: r.extracted_text, storagePath: r.storage_path };
}

/** List a prep's documents (owner-scoped via RLS). */
export async function listPrepDocuments(prepId: string): Promise<PrepDocument[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("meeting_prep_documents")
    .select("id, filename, kind, note, extracted_text, storage_path")
    .eq("prep_id", prepId)
    .order("created_at", { ascending: true });
  // Throw on a genuine error (INV22): [] must mean "no documents", never a swallowed failure — else the user sees
  // an empty prep they populated and re-uploads duplicates.
  if (error) throw new Error(`listPrepDocuments failed: ${error.message}`);
  if (!data) return [];
  return (data as Array<{ id: string; filename: string; kind: PrepDocument["kind"]; note: string; extracted_text: string; storage_path: string }>).map(
    (r) => ({ id: r.id, filename: r.filename, kind: r.kind, note: r.note, extractedText: r.extracted_text, storagePath: r.storage_path })
  );
}

/**
 * Link a prep to its started session + mark it active (owner-scoped via RLS). Returns true ONLY when a row was
 * actually updated: a Postgres UPDATE that matches no row (a stale/foreign/other-company prepId — RLS WITH CHECK)
 * returns NO error, so the old `return !error` reported success while linking nothing → the meeting ran
 * agenda-less and the panel still said "prep loaded" (audit INT-3). `.select("id")` + a row-count check makes the
 * no-op observable so the caller can surface it.
 */
export async function markMeetingPrepStarted(args: { prepId: string; sessionId: string }): Promise<boolean> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("meeting_preps")
    .update({ status: "active", session_id: args.sessionId })
    .eq("id", args.prepId)
    .select("id");
  if (error) {
    console.error(`[markMeetingPrepStarted] failed prep=${args.prepId}: ${error.message}`);
    return false;
  }
  return (data?.length ?? 0) > 0;
}

/**
 * Brain-side read: load the agenda for a live session (by session_id), admin-scoped because it runs in the cue
 * path AFTER the session is owner-verified. Returns null when the session has no prep (a prep-less meeting).
 */
export async function getMeetingPrepBySession(sessionId: string): Promise<MeetingPrep | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("meeting_preps").select("*").eq("session_id", sessionId).maybeSingle();
  // Degrade to agenda-less coaching on a transient error (the cue path must not break), but LOG it — don't
  // SILENTLY return null as if there were no prep (audit: the header claimed honesty; this now honors it).
  if (error) {
    console.error(`[getMeetingPrepBySession] read failed session=${sessionId}: ${error.message}`);
    return null;
  }
  if (!data) return null;
  return mapPrep(data as PrepRow);
}

/** Update the covered flags on a prep's topics (coverage tracking; admin-scoped, runs in the coaching path). */
export async function setMeetingPrepTopicsCovered(args: { prepId: string; topics: PrepTopic[] }): Promise<boolean> {
  const admin = createAdminClient();
  const { error } = await admin.from("meeting_preps").update({ topics: args.topics }).eq("id", args.prepId);
  return !error;
}

/**
 * Condensed document context for the live coach (admin-scoped; runs in the cue path). Concatenates each prep
 * document's note + extracted/OCR'd text, capped so it can't bloat the per-cue prompt. Returns "" when the prep
 * has no documents.
 */
export async function getPrepDocContext(prepId: string, maxChars = 4000): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("meeting_prep_documents")
    .select("filename, note, extracted_text")
    .eq("prep_id", prepId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error(`[getPrepDocContext] read failed prep=${prepId}: ${error.message}`); // degrade, but not silently
    return "";
  }
  if (!data || data.length === 0) return "";
  const blocks = (data as Array<{ filename: string; note: string | null; extracted_text: string | null }>).map((d) => {
    const parts = [`[${d.filename}]`];
    if (d.note?.trim()) parts.push(`note: ${d.note.trim()}`);
    if (d.extracted_text?.trim()) parts.push(d.extracted_text.trim());
    return parts.join(" ");
  });
  return blocks.join("\n").slice(0, maxChars);
}
