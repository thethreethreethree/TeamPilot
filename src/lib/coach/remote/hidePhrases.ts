import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Hide-by-phrase (0337; Gong ledger F33.8; founder pickers "Hide by phrase, admin rules", "Real hide, in stages").
 * A company admin's phrase found in a call's transcript hides the call from everyone but its rep and company admins —
 * the database refuses it (restrictive policies, rss_call_hidden_from_me). This file decides WHICH phrases match
 * (pure) and records the hide (call_hides: the phrase, never the customer's words). Nothing is deleted.
 */
const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();

/** Phrases (id + text) found in the transcript text: case-insensitive, whitespace-insensitive, whole-phrase. Pure. */
export function matchHidePhrases(transcript: string, phrases: Array<{ id: string; phrase: string }>): Array<{ id: string; phrase: string }> {
  const t = ` ${norm(transcript)} `;
  return phrases.filter((p) => {
    const needle = norm(p.phrase);
    if (needle.length < 3) return false;
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+")}($|[^\\p{L}\\p{N}])`, "iu");
    return re.test(t);
  });
}

/** The company's active (not retired) phrases. Throws on a failed read. */
export async function activeHidePhrases(admin: SupabaseClient, companyId: string): Promise<Array<{ id: string; phrase: string }>> {
  const { data, error } = await admin.from("hide_phrases").select("id, phrase").eq("company_id", companyId);
  if (error) throw new Error(`hide phrases read failed: ${error.message}`);
  const list = (data ?? []) as Array<{ id: string; phrase: string }>;
  if (!list.length) return [];
  const { data: ret, error: rErr } = await admin.from("hide_phrase_retirements").select("phrase_id").eq("company_id", companyId).in("phrase_id", list.map((p) => p.id));
  if (rErr) throw new Error(`hide phrase retirements read failed: ${rErr.message}`);
  const retired = new Set(((ret ?? []) as Array<{ phrase_id: string }>).map((r) => String(r.phrase_id)));
  return list.filter((p) => !retired.has(String(p.id))).map((p) => ({ id: String(p.id), phrase: p.phrase }));
}

/**
 * Check one phone/video call against the company's phrases (or `only` — a new phrase's backfill) and record any hide.
 * Called when a transcript lands or is corrected (generateSessionArtifacts, transcript-edit) and by a new phrase's
 * backfill. Never throws; returns the phrases that newly hid the call, or null if it couldn't check. An unhidden call
 * stays unhidden for that phrase (one hide per call and phrase — call_hides_once).
 */
export async function scanCallForHidePhrases(client: SupabaseClient | null, sessionId: string, only?: Array<{ id: string; phrase: string }>): Promise<string[] | null> {
  try {
    // The client is made inside the try (null → service role), so a missing key can't break call processing.
    const admin = client ?? createAdminClient();
    const { data: s, error: sErr } = await admin.from("coaching_sessions").select("company_id, context").eq("id", sessionId).maybeSingle();
    if (sErr) {
      console.error(`[hidePhrases] session read failed session=${sessionId}: ${sErr.message}`);
      return null;
    }
    if (!s || !["phone", "video"].includes(String(s.context))) return [];
    const companyId = String(s.company_id);
    const phrases = only ?? (await activeHidePhrases(admin, companyId));
    if (!phrases.length) return [];
    const { data: segs, error } = await admin.from("coaching_transcript_segments_current").select("text").eq("session_id", sessionId).order("seq", { ascending: true });
    if (error) {
      console.error(`[hidePhrases] transcript read failed session=${sessionId}: ${error.message}`);
      return null;
    }
    const text = ((segs ?? []) as Array<{ text: string }>).map((x) => x.text).join(" \n ");
    const hits = matchHidePhrases(text, phrases);
    const hid: string[] = [];
    for (const h of hits) {
      const { error: iErr } = await admin.from("call_hides").insert({ company_id: companyId, session_id: sessionId, phrase_id: h.id, phrase: h.phrase });
      if (!iErr) hid.push(h.phrase);
      else if (iErr.code !== "23505") console.error(`[hidePhrases] hide insert failed session=${sessionId}: ${iErr.message}`);
    }
    return hid;
  } catch (e) {
    console.error(`[hidePhrases] scan failed session=${sessionId}:`, e);
    return null;
  }
}

/**
 * For service-role readers (0337): which of these calls are hidden FROM this viewer. Asks the database's own rule
 * (rss_call_hidden_for — the function the restrictive policies use), so a route can't drift from RLS (§2.2). Throws on
 * a failed check: a route must not show a call it couldn't confirm is visible.
 */
export async function hiddenFrom(admin: SupabaseClient, sessionIds: string[], viewerId: string): Promise<Set<string>> {
  const ids = [...new Set(sessionIds)];
  const results = await Promise.all(
    ids.map(async (id) => {
      const { data, error } = await admin.rpc("rss_call_hidden_for", { p_session: id, viewer: viewerId });
      if (error) throw new Error(`hidden check failed: ${error.message}`);
      return [id, data === true] as const;
    }),
  );
  return new Set(results.filter(([, h]) => h).map(([id]) => id));
}
