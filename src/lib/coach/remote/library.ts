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
