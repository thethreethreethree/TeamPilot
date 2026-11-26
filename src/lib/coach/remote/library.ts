import type { SupabaseClient } from "@supabase/supabase-js";
import { shareState, type ShareEvent, type ShareState } from "@/lib/coach/recordings/shareState";

/**
 * RSS Phase 5 — snippets and the library (Gong F9.13, F12.5, F12.6). Ported from the scaffold's snippets.ts.
 *
 * CONSENT IS ONE VERDICT. Whether a call may be played to peers is shareState(...).shareable over 0260's log — the
 * same verdict the Recordings tab's "Save as team example" uses. This module only gathers each call's events and
 * returns that verdict; nothing here decides consent a second way (§2.2).
 */
export class SnippetError extends Error {}

/** A snippet must be whole ms, inside the recording (when its length is known), and at least one second. */
export function validateSnippet(startMs: number, endMs: number, sessionMs: number | null): void {
  if (!Number.isInteger(startMs) || !Number.isInteger(endMs)) throw new SnippetError("Times must be whole milliseconds.");
  if (startMs < 0) throw new SnippetError("A clip can't start before the call.");
  if (sessionMs !== null && endMs > sessionMs) throw new SnippetError("A clip must sit inside the recording.");
  if (endMs - startMs < 1000) throw new SnippetError("A clip must be at least one second long.");
}

/** Who may play a library item: the rep, anyone who may view the rep, and peers only while the rep's consent stands. */
export function canPlay(opts: { viewerIsRep: boolean; viewerCanViewRep: boolean; inCompanyFolder: boolean; shareable: boolean }): boolean {
  if (opts.viewerIsRep || opts.viewerCanViewRep) return true;
  return opts.inCompanyFolder && opts.shareable;
}

/** The consent state per call (session), from every pitch score of that call. Company-pinned service-role read. */
export async function shareBySession(
  admin: SupabaseClient,
  companyId: string,
  sessionIds: readonly string[],
): Promise<Map<string, { pitchId: string | null; share: ShareState }>> {
  const out = new Map<string, { pitchId: string | null; share: ShareState }>();
  const none = shareState([]);
  for (const id of sessionIds) out.set(id, { pitchId: null, share: none });
  if (sessionIds.length === 0) return out;
  const { data: pitches, error } = await admin
    .from("pitch_scores")
    .select("id, session_id")
    .eq("company_id", companyId)
    .in("session_id", [...sessionIds]);
  if (error) {
    console.error(`[library] pitch read failed: ${error.message}`);
    return out; // fails closed: no consent known → peers hear nothing
  }
  const sessionByPitch = new Map(((pitches ?? []) as Array<{ id: string; session_id: string }>).map((p) => [String(p.id), String(p.session_id)]));
  if (sessionByPitch.size === 0) return out;
  const { data: events, error: eErr } = await admin
    .from("recording_share_events")
    .select("pitch_id, kind, actor_id, note, created_at")
    .eq("company_id", companyId)
    .in("pitch_id", [...sessionByPitch.keys()]);
  if (eErr) {
    console.error(`[library] share read failed: ${eErr.message}`);
    return out;
  }
  const bySession = new Map<string, ShareEvent[]>();
  for (const e of (events ?? []) as Array<{ pitch_id: string; kind: ShareEvent["kind"]; actor_id: string; note: string | null; created_at: string }>) {
    const s = sessionByPitch.get(String(e.pitch_id));
    if (!s) continue;
    bySession.set(s, [...(bySession.get(s) ?? []), { kind: e.kind, actorId: String(e.actor_id), note: e.note, createdAt: e.created_at }]);
  }
  for (const [pitchId, s] of sessionByPitch) {
    out.set(s, { pitchId, share: shareState(bySession.get(s) ?? []) });
  }
  return out;
}

/** 0346 (F12.6): which folders are archived now — the latest archive/restore per folder wins (by id). Pure. */
export function archivedFolderIds(events: Array<{ id: number; folder_id: string; kind: string }>): Set<string> {
  const latest = new Map<string, { id: number; kind: string }>();
  for (const e of events) {
    const had = latest.get(String(e.folder_id));
    if (!had || e.id > had.id) latest.set(String(e.folder_id), { id: e.id, kind: e.kind });
  }
  return new Set([...latest].filter(([, v]) => v.kind === "archive").map(([k]) => k));
}

/**
 * Nested folders (0353, Gong ledger F12.6). A folder is named as a path — "Objections / Pricing" — and each level is a
 * folder whose parent is fixed when it's created (folders are never updated, 0280). At most MAX_FOLDER_DEPTH levels.
 */
export const MAX_FOLDER_DEPTH = 3;
export class FolderPathError extends Error {}

/** "Objections / Pricing" → ["Objections", "Pricing"]: trimmed, spaces collapsed, empty levels dropped. Throws FolderPathError. */
export function folderPathParts(raw: string): string[] {
  const parts = raw.split("/").map((p) => p.trim().replace(/\s+/g, " ")).filter(Boolean);
  if (parts.length === 0) throw new FolderPathError("Give the folder a name.");
  if (parts.length > MAX_FOLDER_DEPTH) throw new FolderPathError(`Folders go at most ${MAX_FOLDER_DEPTH} levels deep (e.g. Objections / Pricing / Spectrum).`);
  if (parts.some((p) => p.length > 60)) throw new FolderPathError("Each folder name is up to 60 characters.");
  return parts;
}

export type FolderNode = { id: string; parent_id: string | null; name: string };

/** Each folder's full path ("Objections / Pricing"). A parent outside the list shows the folder by its own name. Pure. */
export function folderPaths(folders: FolderNode[]): Map<string, string> {
  const byId = new Map(folders.map((f) => [String(f.id), f]));
  const out = new Map<string, string>();
  for (const f of folders) {
    const names = [f.name];
    let p = f.parent_id ? byId.get(String(f.parent_id)) : undefined;
    // The database caps depth at MAX_FOLDER_DEPTH; the bound here only guards a malformed list.
    for (let i = 0; p && i < MAX_FOLDER_DEPTH; i += 1) {
      names.unshift(p.name);
      p = p.parent_id ? byId.get(String(p.parent_id)) : undefined;
    }
    out.set(String(f.id), names.join(" / "));
  }
  return out;
}

/** Folders with an archived folder above them (not counting themselves): archiving a folder hides what's inside it. Pure. */
export function underArchived(folders: FolderNode[], archived: Set<string>): Set<string> {
  const byId = new Map(folders.map((f) => [String(f.id), f]));
  const out = new Set<string>();
  for (const f of folders) {
    let p = f.parent_id ? byId.get(String(f.parent_id)) : undefined;
    for (let i = 0; p && i < MAX_FOLDER_DEPTH; i += 1) {
      if (archived.has(String(p.id))) {
        out.add(String(f.id));
        break;
      }
      p = p.parent_id ? byId.get(String(p.parent_id)) : undefined;
    }
  }
  return out;
}
