import type { SupabaseClient } from "@supabase/supabase-js";
import { NON_SALES_KINDS } from "@/lib/coach/v5/nonSalesSubjects";
import { toCsv } from "@/lib/export/toCsv";
import { REMOTE_CONTEXTS, SALES_CONTEXTS, isRemoteContext } from "@/lib/coach/sessionContext";
import { elementInAnyRubric } from "@/lib/coach/pitchScore/rubricRegistry";
import { audioBaseIso } from "@/lib/coach/v5/segmentTiming";

/**
 * RSS Phase 5 — find calls (Gong F12.1, F12.2; docs/rss/docs/06-UI-SPEC.md "Find").
 *
 * ONE search, two consumers: the Search page (GET /api/coach/remote/search) and the managers' CSV export
 * (…/search/export). Both call runCallSearch with the CALLER's client, so RLS decides what is searchable — a rep
 * finds their own calls, a manager the reps the 0273 reporting tree lets them see. Nothing here widens access.
 *
 * Sales calls only (meetings and huddles are left out by the same NON_SALES_KINDS list the session list uses).
 * Transcript words match on the 0280 'simple' full-text index: exact words, quoted phrases, OR, -exclude
 * (Postgres websearch syntax), no stemming.
 *
 * Filters: words, channel, rep, outcome, date range, score range, keyword tracker, and (2026-11-22, the Phase 5 R2
 * residual) rubric element + grade, the rep's talk share, and disputed.
 */
export type CallSearchFilters = {
  q?: string;
  channel?: string;
  repId?: string;
  outcome?: string;
  from?: string; // ISO date
  to?: string; // ISO date
  scoreMin?: number;
  scoreMax?: number;
  trackerId?: string;
  /** Rubric element (any rubric — elementInAnyRubric) and the grade the call got on it — "who missed the price close". */
  elementId?: string;
  grade?: "hit" | "partial" | "missed";
  /** The rep's share of speaking time, as whole percent (session_interaction_stats.talk_ratio_time). */
  talkMin?: number;
  talkMax?: number;
  /** Only calls whose score the rep disputed. */
  disputed?: boolean;
  /** A topic or competitor the call's AI read found (coach.session_intel_generated) — Gong F11.12. Case-insensitive. */
  topic?: string;
  /** Remote Sales' own search: phone and video calls only (founder 2026-11-22, separate from Sales Coach). */
  remoteOnly?: boolean;
  /** Internal (never parsed from a URL): calls that ENDED at or after this time — a followed search's "new" (0342). */
  endedAfter?: string;
};

export type CallSearchHit = { seq: number; speaker: string; text: string; atMs: number | null };
export type CallSearchRow = {
  sessionId: string;
  repId: string;
  repName: string | null;
  channel: string;
  callLabel: string | null;
  startedAt: string;
  outcome: string | null;
  score: number | null;
  hits: CallSearchHit[];
};
export type CallSearchResult =
  /** truncated: more than MAX_ROWS calls matched. narrower: the word or tracker match hit its read cap, so some
   *  matching calls may be missing; the page asks for a narrower search rather than implying it is complete. */
  | { ok: true; rows: CallSearchRow[]; truncated: boolean; narrower?: boolean }
  | { ok: false; status: 400 | 500 | 503; error: string };

const MAX_ROWS = 200;
const MAX_HITS_PER_CALL = 5;
const MISSING = new Set(["PGRST205", "42P01", "42703", "PGRST204"]);
const OUTCOMES = new Set(["sold", "follow_up", "no_sale", "undecided"]);

/** Parse and bound query-string filters. Returns an error sentence for anything malformed. */
export function parseCallSearch(params: URLSearchParams): { filters: CallSearchFilters } | { error: string } {
  const f: CallSearchFilters = {};
  const q = params.get("q")?.trim();
  if (q) {
    if (q.length > 200) return { error: "Keep the search under 200 characters." };
    f.q = q;
  }
  const channel = params.get("channel");
  if (channel && channel !== "all") {
    if (!(SALES_CONTEXTS as readonly string[]).includes(channel)) return { error: "Unknown channel." };
    f.channel = channel;
  }
  const uuid = /^[0-9a-f-]{36}$/i;
  const rep = params.get("rep");
  if (rep) {
    if (!uuid.test(rep)) return { error: "Unknown rep." };
    f.repId = rep;
  }
  const tracker = params.get("tracker");
  if (tracker) {
    if (!uuid.test(tracker)) return { error: "Unknown tracker." };
    f.trackerId = tracker;
  }
  const outcome = params.get("outcome");
  if (outcome && outcome !== "all") {
    if (!OUTCOMES.has(outcome)) return { error: "Unknown outcome." };
    f.outcome = outcome;
  }
  for (const k of ["from", "to"] as const) {
    const v = params.get(k);
    if (v) {
      if (Number.isNaN(Date.parse(v))) return { error: `The ${k} date isn't a date.` };
      f[k] = new Date(v).toISOString();
    }
  }
  for (const [k, key] of [["scoreMin", "scoreMin"], ["scoreMax", "scoreMax"]] as const) {
    const v = params.get(k);
    if (v !== null && v !== "") {
      const n = Number(v);
      if (!Number.isFinite(n)) return { error: "A score bound must be a number." };
      f[key] = n;
    }
  }
  const element = params.get("element");
  if (element) {
    // Any rubric (2026-11-25): the Search page offers the phone/video rubric's items, and the door rubric alone refused
    // the phone-only ones ("Reason for the call") as unknown.
    if (!elementInAnyRubric(element)) return { error: "Unknown rubric element." };
    f.elementId = element;
    const grade = params.get("grade") ?? "missed";
    if (grade !== "hit" && grade !== "partial" && grade !== "missed") return { error: "Grade must be hit, partial or missed." };
    f.grade = grade;
  }
  for (const [k, key] of [["talkMin", "talkMin"], ["talkMax", "talkMax"]] as const) {
    const v = params.get(k);
    if (v !== null && v !== "") {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > 100) return { error: "Talk share is a percent from 0 to 100." };
      f[key] = n;
    }
  }
  if (params.get("disputed") === "1") f.disputed = true;
  const topic = (params.get("topic") ?? "").trim().toLowerCase();
  if (topic) {
    if (topic.length > 60) return { error: "Keep the topic under 60 characters." };
    f.topic = topic;
  }
  return { filters: f };
}

/**
 * Which calls' latest intel read names `term` among its topics or competitors (case-insensitive, substring — "price"
 * finds "pricing"). Events arrive newest first; only the first (latest) read per call counts. Pure.
 */
export function sessionsWithTopic(events: Array<{ subject: string | null; payload: unknown }>, term: string): Set<string> {
  const seen = new Set<string>();
  const out = new Set<string>();
  const t = term.toLowerCase();
  for (const e of events) {
    const id = typeof e.subject === "string" && e.subject.startsWith("sales_session:") ? e.subject.slice("sales_session:".length) : null;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const intel = (e.payload as { intel?: { topics?: unknown; competitors?: unknown } } | null)?.intel;
    const words = [...(Array.isArray(intel?.topics) ? intel.topics : []), ...(Array.isArray(intel?.competitors) ? intel.competitors : [])];
    if (words.some((w) => typeof w === "string" && w.toLowerCase().includes(t))) out.add(id);
  }
  return out;
}

/** Narrow the call set to `ids` (intersect when a set already exists). Null means "no restriction yet". */
function narrow(current: Set<string> | null, ids: Set<string>): Set<string> {
  return current ? new Set([...current].filter((id) => ids.has(id))) : ids;
}

export async function runCallSearch(db: SupabaseClient, f: CallSearchFilters): Promise<CallSearchResult> {
  // Remote Sales searches its own calls only; an in-person channel there matches nothing.
  if (f.remoteOnly && f.channel && !isRemoteContext(f.channel)) return { ok: true, rows: [], truncated: false };
  // 1. Words → which calls, and the matching lines.
  const hitsBySession = new Map<string, CallSearchHit[]>();
  let restrictTo: Set<string> | null = null;
  let narrower = false; // PostgREST returns at most 1000 rows; a full page means there may be more matches
  const READ_CAP = 1000;
  if (f.q) {
    const { data, error } = await db
      .from("coaching_transcript_segments_current")
      .select("session_id, seq, speaker, text, spoken_at")
      .textSearch("text", f.q, { config: "simple", type: "websearch" })
      .order("seq", { ascending: true })
      .limit(READ_CAP);
    if (error) {
      console.error(`[callSearch] transcript search failed: ${error.message}`);
      return { ok: false, status: 500, error: "The transcript search failed." };
    }
    if ((data ?? []).length >= READ_CAP) narrower = true;
    restrictTo = new Set();
    for (const r of (data ?? []) as Array<{ session_id: string; seq: number; speaker: string; text: string; spoken_at: string | null }>) {
      const k = String(r.session_id);
      restrictTo.add(k);
      const list = hitsBySession.get(k) ?? [];
      if (list.length < MAX_HITS_PER_CALL) {
        list.push({ seq: r.seq, speaker: r.speaker, text: r.text, atMs: r.spoken_at ? Date.parse(r.spoken_at) : null });
      }
      hitsBySession.set(k, list);
    }
    if (restrictTo.size === 0) return { ok: true, rows: [], truncated: false };
  }

  // 2. Tracker → which calls mention it.
  if (f.trackerId) {
    const { data, error } = await db.from("tracker_hits").select("session_id").eq("tracker_id", f.trackerId).limit(READ_CAP);
    if (error) {
      if (MISSING.has(String(error.code))) return { ok: false, status: 503, error: "Tracker filters are waiting on database migration 0276." };
      console.error(`[callSearch] tracker read failed: ${error.message}`);
      return { ok: false, status: 500, error: "The tracker filter failed." };
    }
    if ((data ?? []).length >= READ_CAP) narrower = true;
    const ids = new Set(((data ?? []) as Array<{ session_id: string }>).map((r) => String(r.session_id)));
    restrictTo = restrictTo ? new Set([...restrictTo].filter((id) => ids.has(id))) : ids;
    if (restrictTo.size === 0) return { ok: true, rows: [], truncated: false };
  }

  // 2b. Rubric element + grade → which calls (RLS on both tables decides what is visible).
  if (f.elementId) {
    const { data: els, error } = await db.from("pitch_score_elements").select("pitch_id").eq("element_id", f.elementId).eq("grade", f.grade ?? "missed").limit(READ_CAP);
    if (error) {
      console.error(`[callSearch] element read failed: ${error.message}`);
      return { ok: false, status: 500, error: "The rubric filter failed." };
    }
    if ((els ?? []).length >= READ_CAP) narrower = true;
    const pitchIds = [...new Set(((els ?? []) as Array<{ pitch_id: string }>).map((r) => String(r.pitch_id)))];
    const { data: ps, error: pErr } = pitchIds.length
      ? await db.from("pitch_scores").select("session_id").in("id", pitchIds)
      : { data: [], error: null };
    if (pErr) {
      console.error(`[callSearch] pitch read failed: ${pErr.message}`);
      return { ok: false, status: 500, error: "The rubric filter failed." };
    }
    restrictTo = narrow(restrictTo, new Set(((ps ?? []) as Array<{ session_id: string | null }>).filter((r) => r.session_id).map((r) => String(r.session_id))));
    if (restrictTo.size === 0) return { ok: true, rows: [], truncated: false };
  }

  // 2c. Disputed → calls whose score the rep disputed (the dispute events name the call).
  if (f.disputed) {
    const { data: evs, error } = await db.from("events").select("payload").eq("kind", "coach.pitch_score_disputed").order("created_at", { ascending: false }).limit(READ_CAP);
    if (error) {
      console.error(`[callSearch] dispute read failed: ${error.message}`);
      return { ok: false, status: 500, error: "The disputed filter failed." };
    }
    if ((evs ?? []).length >= READ_CAP) narrower = true;
    const ids = new Set<string>();
    for (const e of (evs ?? []) as Array<{ payload: Record<string, unknown> | null }>) {
      const sid = e.payload?.session_id;
      if (typeof sid === "string" && sid) ids.add(sid);
    }
    restrictTo = narrow(restrictTo, ids);
    if (restrictTo.size === 0) return { ok: true, rows: [], truncated: false };
  }

  // 2d. Topic or competitor → calls whose LATEST intel read names it (F11.12). The intel engine stores 3–5 topics and
  // the competitors actually said, per call, as events; a newer read of a call replaces the older in this match.
  if (f.topic) {
    const { data: evs, error } = await db
      .from("events")
      .select("subject, payload")
      .eq("kind", "coach.session_intel_generated")
      .order("created_at", { ascending: false })
      .limit(READ_CAP);
    if (error) {
      console.error(`[callSearch] topic read failed: ${error.message}`);
      return { ok: false, status: 500, error: "The topic filter failed." };
    }
    if ((evs ?? []).length >= READ_CAP) narrower = true;
    restrictTo = narrow(restrictTo, sessionsWithTopic((evs ?? []) as Array<{ subject: string | null; payload: unknown }>, f.topic));
    if (restrictTo.size === 0) return { ok: true, rows: [], truncated: false };
  }

  // 3. Calls, with every remaining filter, RLS-scoped.
  let query = db
    .from("coaching_sessions")
    .select("id, agent_id, context, client_label, started_at, audio_started_at, outcome")
    .not("session_kind", "in", `(${NON_SALES_KINDS.join(",")})`)
    .order("started_at", { ascending: false })
    .limit(MAX_ROWS + 1);
  if (restrictTo) {
    if (restrictTo.size > READ_CAP) narrower = true;
    query = query.in("id", [...restrictTo].slice(0, READ_CAP));
  }
  if (f.channel) query = query.eq("context", f.channel);
  else if (f.remoteOnly) query = query.in("context", [...REMOTE_CONTEXTS]);
  if (f.repId) query = query.eq("agent_id", f.repId);
  if (f.outcome) query = query.eq("outcome", f.outcome);
  if (f.from) query = query.gte("started_at", f.from);
  if (f.to) query = query.lte("started_at", f.to);
  if (f.endedAfter) query = query.gte("ended_at", f.endedAfter);
  const { data: sessions, error: sErr } = await query;
  if (sErr) {
    console.error(`[callSearch] session read failed: ${sErr.message}`);
    return { ok: false, status: 500, error: "The search failed." };
  }
  type S = { id: string; agent_id: string; context: string; client_label: string | null; started_at: string; audio_started_at: string | null; outcome: string | null };
  let rows = (sessions ?? []) as S[];
  const truncated = rows.length > MAX_ROWS;
  rows = rows.slice(0, MAX_ROWS);
  if (rows.length === 0) return { ok: true, rows: [], truncated: false, narrower };

  // 4. Scores and names for those calls.
  const ids = rows.map((r) => String(r.id));
  const wantTalk = f.talkMin !== undefined || f.talkMax !== undefined;
  const [{ data: scores }, { data: people }, statsRead] = await Promise.all([
    db.from("pitch_scores").select("session_id, total").in("session_id", ids),
    db.from("profiles").select("id, full_name").in("id", [...new Set(rows.map((r) => String(r.agent_id)))]),
    wantTalk
      ? db.from("session_interaction_stats").select("session_id, transcript_version, talk_ratio_time").in("session_id", ids)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (statsRead.error) {
    console.error(`[callSearch] stats read failed: ${statsRead.error.message}`);
    return { ok: false, status: 500, error: "The talk-share filter failed." };
  }
  // The newest transcript version's stats per call — what the session page shows.
  const talkBySession = new Map<string, { v: number; ratio: number | null }>();
  for (const st of (statsRead.data ?? []) as Array<{ session_id: string; transcript_version: number; talk_ratio_time: number | string | null }>) {
    const k = String(st.session_id);
    const prev = talkBySession.get(k);
    if (!prev || st.transcript_version > prev.v) talkBySession.set(k, { v: st.transcript_version, ratio: st.talk_ratio_time === null ? null : Number(st.talk_ratio_time) });
  }
  const scoreBySession = new Map(((scores ?? []) as Array<{ session_id: string; total: number | string }>).map((s) => [String(s.session_id), Number(s.total)]));
  const nameById = new Map(((people ?? []) as Array<{ id: string; full_name: string | null }>).map((p) => [String(p.id), p.full_name]));

  const out: CallSearchRow[] = [];
  for (const r of rows) {
    const score = scoreBySession.get(String(r.id)) ?? null;
    if (f.scoreMin !== undefined && (score === null || score < f.scoreMin)) continue;
    if (f.scoreMax !== undefined && (score === null || score > f.scoreMax)) continue;
    if (wantTalk) {
      const ratio = talkBySession.get(String(r.id))?.ratio ?? null;
      if (ratio === null) continue; // no measured talk share — it cannot satisfy a talk filter
      if (f.talkMin !== undefined && ratio * 100 < f.talkMin) continue;
      if (f.talkMax !== undefined && ratio * 100 > f.talkMax) continue;
    }
    // Offsets from the recording's own clock (0300), as every other reader of a line's position.
    const started = Date.parse(audioBaseIso(r.started_at, r.audio_started_at) ?? r.started_at);
    out.push({
      sessionId: String(r.id),
      repId: String(r.agent_id),
      repName: nameById.get(String(r.agent_id)) ?? null,
      channel: r.context,
      callLabel: r.client_label,
      startedAt: r.started_at,
      outcome: r.outcome,
      score,
      // Hit times become offsets into the call, so the session page can play from them.
      hits: (hitsBySession.get(String(r.id)) ?? []).map((h) => ({ ...h, atMs: h.atMs === null ? null : Math.max(0, h.atMs - started) })),
    });
  }
  return { ok: true, rows: out, truncated, narrower };
}

/** CSV for the managers' export. Every cell quoted; a leading = + - @ is neutralised (spreadsheet formula injection). */
/** Through the shared toCsv → neutralizeCsvFormula (CWE-1236), never a local copy of the formula guard. */
export function callSearchCsv(rows: CallSearchRow[]): string {
  const head = ["Date", "Rep", "Channel", "Call", "Outcome", "Score", "Matching lines", "Session id"];
  return toCsv(
    rows.map((r) => ({
      Date: r.startedAt,
      Rep: r.repName ?? "",
      Channel: r.channel,
      Call: r.callLabel ?? "",
      Outcome: r.outcome ?? "",
      Score: r.score ?? "",
      "Matching lines": r.hits.map((h) => h.text).join(" | "),
      "Session id": r.sessionId,
    })),
    head,
  );
}
