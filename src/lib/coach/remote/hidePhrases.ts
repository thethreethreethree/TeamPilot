import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPagedResult } from "@/lib/supabase/paginate";

/**
 * Review 2026-11-26: every read here is paged (PostgREST returns at most 1000 rows — an unpaged read silently drops the
 * rest) and every id list is chunked (a long .in() list makes a URL too long to send). A failed read throws.
 */
const CHUNK = 150;
async function allRows<T>(label: string, make: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await fetchAllPagedResult<T>(make, { label, maxRows: 200_000 });
  if (error) throw new Error(`${label} read failed: ${error.message}`);
  return data ?? [];
}
const chunks = <T,>(xs: T[]) => Array.from({ length: Math.ceil(xs.length / CHUNK) }, (_, i) => xs.slice(i * CHUNK, (i + 1) * CHUNK));

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
  const rows = await allRows<{ id: string; session_id: string; phrase: string; created_at: string }>("call hides", (f, t) =>
    admin.from("call_hides").select("id, session_id, phrase, created_at").eq("company_id", companyId).order("created_at", { ascending: false }).order("id", { ascending: true }).range(f, t),
  );
  if (!rows.length) return [];
  const gone = new Set<string>();
  for (const ids of chunks(rows.map((h) => String(h.id)))) {
    const un = await allRows<{ hide_id: string }>("call unhides", (f, t) => admin.from("call_unhides").select("hide_id").eq("company_id", companyId).in("hide_id", ids).order("hide_id", { ascending: true }).range(f, t));
    for (const u of un) gone.add(String(u.hide_id));
  }
  const bySession = new Map<string, { sessionId: string; phrases: string[]; hiddenAt: string }>();
  for (const h of rows) {
    if (gone.has(String(h.id))) continue;
    const e = bySession.get(String(h.session_id)) ?? { sessionId: String(h.session_id), phrases: [], hiddenAt: h.created_at };
    if (!e.phrases.includes(h.phrase)) e.phrases.push(h.phrase);
    bySession.set(e.sessionId, e);
  }
  const list = [...bySession.values()].slice(0, limit);
  if (!list.length) return [];
  const info = new Map<string, { id: string; client_label: string | null; started_at: string | null; agent_id: string }>();
  for (const ids of chunks(list.map((l) => l.sessionId))) {
    const { data: ss, error: sErr } = await admin.from("coaching_sessions").select("id, client_label, started_at, agent_id").eq("company_id", companyId).in("id", ids);
    if (sErr) throw new Error(`hidden calls read failed: ${sErr.message}`);
    for (const x of (ss ?? []) as Array<{ id: string; client_label: string | null; started_at: string | null; agent_id: string }>) info.set(String(x.id), x);
  }
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
    // Paged: a phrase said after the 1000th line must still hide the call (review 2026-11-26).
    const { data: segs, error } = await fetchAllPagedResult<{ text: string }>(
      (f, t) => admin.from("coaching_transcript_segments_current").select("text, seq").eq("session_id", sessionId).order("seq", { ascending: true }).range(f, t),
      { label: "hide-phrase transcript", maxRows: 100_000 },
    );
    if (error) {
      console.error(`[hidePhrases] transcript read failed session=${sessionId}: ${error.message}`);
      return null;
    }
    const text = (segs ?? []).map((x) => x.text).join(" \n ");
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
  for (const ids of chunks(all)) {
    const rows = await allRows<{ session_id: string }>("hidden check", (f, t) => admin.from("call_hides").select("session_id").in("session_id", ids).order("session_id", { ascending: true }).range(f, t));
    for (const r of rows) withHide.add(String(r.session_id));
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
 * For a company-wide list (0337): every call of this company hidden FROM this viewer, from one database call that
 * judges each of the company's hidden calls with rss_call_hidden_for — the same verdict as hiddenFrom (§2.2). Throws on a failed read: a route must not show a call it
 * couldn't confirm is visible.
 */
export async function hiddenInCompanyFrom(admin: SupabaseClient, companyId: string, viewerId: string): Promise<Set<string>> {
  // One call (0345's rss_hidden_calls_for: the company's active hides, each judged by rss_call_hidden_for), paged.
  const rows = await allRows<string | { rss_hidden_calls_for?: string }>("hidden check", (f, t) =>
    admin.rpc("rss_hidden_calls_for", { p_company: companyId, p_viewer: viewerId }).range(f, t) as unknown as PromiseLike<{ data: Array<string | { rss_hidden_calls_for?: string }> | null; error: { message: string } | null }>,
  );
  return new Set(rows.map((r) => String(typeof r === "string" ? r : r.rss_hidden_calls_for)));
}
