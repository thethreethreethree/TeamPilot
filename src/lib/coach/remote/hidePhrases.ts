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
 * The company's hidden calls (active hides, whatever became of the phrase), newest first — for admins in Protection, so
 * a call hidden by a phrase that was later retired can still be found and unhidden. Throws on a failed read.
 */
export async function hiddenCallsForCompany(admin: SupabaseClient, companyId: string, limit = 200) {
  const { data: hides, error } = await admin.from("call_hides").select("id, session_id, phrase, created_at").eq("company_id", companyId).order("created_at", { ascending: false }).limit(1000);
  if (error) throw new Error(`call hides read failed: ${error.message}`);
  const rows = (hides ?? []) as Array<{ id: string; session_id: string; phrase: string; created_at: string }>;
  if (!rows.length) return [];
  const { data: un, error: uErr } = await admin.from("call_unhides").select("hide_id").eq("company_id", companyId).in("hide_id", rows.map((h) => h.id));
  if (uErr) throw new Error(`call unhides read failed: ${uErr.message}`);
  const gone = new Set(((un ?? []) as Array<{ hide_id: string }>).map((u) => String(u.hide_id)));
  const bySession = new Map<string, { sessionId: string; phrases: string[]; hiddenAt: string }>();
  for (const h of rows) {
    if (gone.has(String(h.id))) continue;
    const e = bySession.get(String(h.session_id)) ?? { sessionId: String(h.session_id), phrases: [], hiddenAt: h.created_at };
    if (!e.phrases.includes(h.phrase)) e.phrases.push(h.phrase);
    bySession.set(e.sessionId, e);
  }
  const list = [...bySession.values()].slice(0, limit);
  if (!list.length) return [];
  const { data: ss, error: sErr } = await admin.from("coaching_sessions").select("id, client_label, started_at, agent_id").eq("company_id", companyId).in("id", list.map((l) => l.sessionId));
  if (sErr) throw new Error(`hidden calls read failed: ${sErr.message}`);
  const info = new Map(((ss ?? []) as Array<{ id: string; client_label: string | null; started_at: string | null; agent_id: string }>).map((x) => [String(x.id), x]));
  return list
    .filter((l) => info.has(l.sessionId))
    .map((l) => ({ ...l, label: info.get(l.sessionId)!.client_label, startedAt: info.get(l.sessionId)!.started_at, repId: String(info.get(l.sessionId)!.agent_id) }));
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
  // Most calls have no hide at all, so one read of call_hides narrows the list first; only calls with a hide row go to
  // the SQL authority. The prefilter is the authority's own first term (an active hide must exist — rss_call_hidden_for
  // in 0337), applied as "no row → not hidden"; every verdict for a call WITH a row is the authority's (§2.2). The ids
  // come from the caller's company-scoped reads; hides are keyed by session, so no other company's row can match.
  const all = [...new Set(sessionIds)];
  const withHide = new Set<string>();
  for (let i = 0; i < all.length; i += 200) {
    const { data, error } = await admin.from("call_hides").select("session_id").in("session_id", all.slice(i, i + 200));
    if (error) throw new Error(`hidden check failed: ${error.message}`);
    for (const r of (data ?? []) as Array<{ session_id: string }>) withHide.add(String(r.session_id));
  }
  const ids = all.filter((id) => withHide.has(id));
  const results = await Promise.all(
    ids.map(async (id) => {
      const { data, error } = await admin.rpc("rss_call_hidden_for", { p_session: id, viewer: viewerId });
      if (error) throw new Error(`hidden check failed: ${error.message}`);
      return [id, data === true] as const;
    }),
  );
  return new Set(results.filter(([, h]) => h).map(([id]) => id));
}

/**
 * For a company-wide list (0337): every call of this company hidden FROM this viewer. A company has few hides, so this
 * reads its hide rows once (not one check per listed call) and asks the database rule (rss_call_hidden_for) about each
 * call that has one — the same verdict as hiddenFrom (§2.2). Throws on a failed read: a route must not show a call it
 * couldn't confirm is visible.
 */
export async function hiddenInCompanyFrom(admin: SupabaseClient, companyId: string, viewerId: string): Promise<Set<string>> {
  const { data, error } = await admin.from("call_hides").select("session_id").eq("company_id", companyId);
  if (error) throw new Error(`hidden check failed: ${error.message}`);
  const ids = [...new Set(((data ?? []) as Array<{ session_id: string }>).map((r) => String(r.session_id)))];
  const results = await Promise.all(
    ids.map(async (id) => {
      const { data: h, error: e } = await admin.rpc("rss_call_hidden_for", { p_session: id, viewer: viewerId });
      if (e) throw new Error(`hidden check failed: ${e.message}`);
      return [id, h === true] as const;
    }),
  );
  return new Set(results.filter(([, h]) => h).map(([id]) => id));
}
