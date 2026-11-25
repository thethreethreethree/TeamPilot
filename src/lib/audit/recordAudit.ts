import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The audit log (RSS Phase 8, migration 0284; Gong F31.5): who did what to a recording, a score or an export.
 *
 * ONE writer, so every sensitive route records the same shape and INVARIANT 37 can ask each of them for it.
 * Called AFTER the action has succeeded: the action cannot be taken back, so a failed audit write never turns a
 * success into an error the person would retry (an override applied twice into an append-only table). It is
 * logged loudly instead, and the return value says whether the row landed. Never throws.
 *
 * Writes with the service role: audit_log has no client insert policy, so a client cannot forge an entry.
 */
export const AUDIT_ACTIONS = [
  "score.rescore",
  "score.override",
  "recording.delete",
  "recording.trim",
  "recording.trim_restore",
  "session.export",
  // A manager downloaded one call's audio or transcript (RSS Phase 5, F9.15).
  "session.download",
  "retention.set",
  // A company admin changed the transcription vocabulary (0306, Gong F8.9).
  "vocabulary.set",
  "erasure.request",
  "webhook.add",
  "webhook.off",
  // A recording nothing referenced, removed by the sweeper (0299; docs/STORAGE-ORPHANS-2026-11-21.md). System actor.
  "recording.orphan_purge",
  // Multi-factor sign-in (2026-11-23): a person turned on / removed an authenticator; an admin reset a member's.
  "mfa.enabled",
  "mfa.removed",
  "mfa.reset",
  // Editable transcripts (0311): the call's rep or their manager corrected one line (a new transcript version).
  "transcript.edit",
  // ...and asked for the AI notes (summary, review, follow-through) to be redone on the corrected words (2026-11-23).
  "transcript.refresh_notes",
  // Per-call access (0336, F3.8): an admin gave / took back one teammate's access to one call; the grantee opened it.
  "call.grant",
  "call.grant_revoke",
  "call.view_granted",
  // Hide-by-phrase (0337, F33.8): an admin added / retired a phrase, or unhid a call.
  "call.hide_phrase_add",
  "call.hide_phrase_retire",
  "call.unhide",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditEntry = {
  companyId: string;
  actorId: string | null;
  action: AuditAction;
  objectType: string;
  objectId: string;
  meta?: Record<string, unknown>;
};

export async function recordAudit(admin: SupabaseClient, e: AuditEntry): Promise<boolean> {
  try {
    const { error } = await admin.from("audit_log").insert({
      company_id: e.companyId,
      actor_id: e.actorId,
      action: e.action,
      object_type: e.objectType,
      object_id: e.objectId.slice(0, 200),
      meta: e.meta ?? {},
    });
    if (error) {
      console.error(`[audit] NOT RECORDED ${e.action} ${e.objectType}:${e.objectId} by ${e.actorId}: ${error.message}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[audit] NOT RECORDED ${e.action} ${e.objectType}:${e.objectId} (threw):`, err);
    return false;
  }
}
