import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPagedResult } from "@/lib/supabase/paginate";
import { followThroughCoach } from "@/lib/claude";
import { CONVERSATION_IS_DATA } from "@/lib/care/toolPrompts";
import { isRemoteContext } from "@/lib/coach/sessionContext";
import { isSalesCall } from "@/lib/coach/v5/salesOnly";

/**
 * RSS Phase 6 — the follow-through read of a phone/video sales call (Gong F25.11 AI outcome, F26.4 callbacks;
 * migration 0281).
 *
 * HONESTY GUARDS, all enforced here rather than trusted to the prompt:
 *   · every callback must quote its line, and the quote must actually be in that line (normalised) — an item whose
 *     quote is not in the transcript is dropped, so a to-do can never be invented;
 *   · a due date is kept only when it is a real date between the call and 180 days after it; otherwise null
 *     ("no date said") rather than a guessed one;
 *   · the suggested outcome may be null ("can't tell"), and must point at a line that exists.
 * GUIDE, DON'T OVERTAKE (§3.3): the AI's outcome is stored now but SHOWN only after the rep has recorded their own
 * (the follow-through route returns it only then) — the rep's judgement comes first, the AI's is a second opinion.
 */
export const OUTCOMES = ["sold", "follow_up", "no_sale", "undecided"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export type Line = { seq: number; speaker: string; text: string; atMs: number | null };
export type Callback = { what: string; due: string | null; quote: string; seq: number; atMs: number | null };
export type FollowThroughRead = { suggestedOutcome: Outcome | null; why: string | null; outcomeSeq: number | null; callbacks: Callback[] };

const SPEAKER_WORD: Record<string, string> = { rep: "REP", customer: "CUSTOMER" };
const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;

/** `[seq] (m:ss) SPEAKER: text` — the line numbers the model must cite. */
export function numberedTranscript(lines: Line[]): string {
  return lines
    .map((l) => `[${l.seq}]${l.atMs !== null ? ` (${mmss(l.atMs)})` : ""} ${SPEAKER_WORD[l.speaker] ?? "UNCLEAR"}: ${l.text}`)
    .join("\n");
}

export const FOLLOW_THROUGH_SYSTEM = `You read the transcript of a sales call (phone or video) and report two things, as JSON only.

1. outcome — how the call ended, ONE of "sold", "follow_up", "no_sale", "undecided", or null if the transcript does not
   show it. "why" is one plain sentence pointing at what was said. "seq" is the [number] of the line it rests on.
2. callbacks — things the REP agreed to do after the call that the customer asked for or agreed to (call back, send a
   quote, email a contract). At most 5. For each: "what" (a short to-do, imperative, under 15 words), "due" (a date
   YYYY-MM-DD ONLY if a day was said or clearly implied, resolved against the call date given; otherwise null),
   "quote" (the customer's or rep's exact words from that line, copied verbatim, under 25 words) and "seq".

Return exactly: {"outcome": {"value": ..., "why": ..., "seq": ...}, "callbacks": [{"what": ..., "due": ..., "quote": ..., "seq": ...}]}
Never invent a callback that was not said. An empty list is a correct answer.`;

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Validate the model's JSON against the transcript. Pure. Drops anything the transcript does not support. */
export function parseFollowThrough(raw: string, lines: Line[], callDate: Date): FollowThroughRead {
  const empty: FollowThroughRead = { suggestedOutcome: null, why: null, outcomeSeq: null, callbacks: [] };
  let j: unknown;
  try {
    j = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    return empty;
  }
  if (!j || typeof j !== "object") return empty;
  const bySeq = new Map(lines.map((l) => [l.seq, l]));
  const o = (j as { outcome?: { value?: unknown; why?: unknown; seq?: unknown } }).outcome;
  const value = typeof o?.value === "string" && (OUTCOMES as readonly string[]).includes(o.value) ? (o.value as Outcome) : null;
  const oSeq = Number(o?.seq);
  const outcomeOk = value !== null && bySeq.has(oSeq);

  const lo = callDate.getTime() - 86_400_000;
  const hi = callDate.getTime() + 180 * 86_400_000;
  const callbacks: Callback[] = [];
  const list = Array.isArray((j as { callbacks?: unknown }).callbacks) ? ((j as { callbacks: unknown[] }).callbacks) : [];
  for (const c of list.slice(0, 5)) {
    if (!c || typeof c !== "object") continue;
    const { what, due, quote, seq } = c as Record<string, unknown>;
    const line = bySeq.get(Number(seq));
    if (typeof what !== "string" || !what.trim() || typeof quote !== "string" || !line) continue;
    const q = norm(quote);
    if (!q || !norm(line.text).includes(q)) continue; // quote not in its line → invented → dropped
    let d: string | null = null;
    if (typeof due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(due)) {
      const t = Date.parse(`${due}T12:00:00Z`);
      if (Number.isFinite(t) && t >= lo && t <= hi) d = due;
    }
    callbacks.push({ what: what.trim().slice(0, 200), due: d, quote: quote.trim().slice(0, 300), seq: line.seq, atMs: line.atMs });
  }
  return {
    suggestedOutcome: outcomeOk ? value : null,
    why: outcomeOk && typeof o?.why === "string" ? o.why.trim().slice(0, 400) : null,
    outcomeSeq: outcomeOk ? oSeq : null,
    callbacks,
  };
}

type SessionRow = { id: string; company_id: string; agent_id: string; context: string; session_kind: string | null; started_at: string };

/** The current transcript as numbered lines, offsets from the call start. Any client (caller's or service role). */
export async function loadLines(db: SupabaseClient, sessionId: string, startedAt: string): Promise<{ lines: Line[]; version: number } | null> {
  // Every line: PostgREST caps a read at 1000 rows, and a cut-off transcript would hide late callbacks from the AI.
  const { data, error } = await fetchAllPagedResult<{ seq: number; speaker: string; text: string; spoken_at: string | null; version: number | null }>(
    (from, to) =>
      db
        .from("coaching_transcript_segments_current")
        .select("seq, speaker, text, spoken_at, version")
        .eq("session_id", sessionId)
        .order("seq", { ascending: true })
        .range(from, to),
    { label: "follow-through transcript", maxRows: 20_000 },
  );
  if (error) {
    console.error(`[followThrough] transcript read failed session=${sessionId}: ${error.message}`);
    return null;
  }
  const rows = (data ?? []) as Array<{ seq: number; speaker: string; text: string; spoken_at: string | null; version: number | null }>;
  const t0 = Date.parse(startedAt);
  return {
    version: Math.max(1, Number(rows[0]?.version) || 1),
    lines: rows.map((r) => ({
      seq: Number(r.seq),
      speaker: r.speaker,
      text: r.text,
      atMs: r.spoken_at && Number.isFinite(t0) ? Math.max(0, Date.parse(r.spoken_at) - t0) : null,
    })),
  };
}

/**
 * Pipeline + on-demand: read the call once per transcript version and store it. Never throws. Returns the stored
 * row's id, or null (not a remote sales call, no transcript, AI suppressed/failed, migration missing).
 */
export async function runFollowThrough(sessionId: string, client?: SupabaseClient): Promise<string | null> {
  try {
    const admin = client ?? createAdminClient();
    const { data: s } = await admin
      .from("coaching_sessions")
      .select("id, company_id, agent_id, context, session_kind, started_at")
      .eq("id", sessionId)
      .maybeSingle();
    const session = s as SessionRow | null;
    if (!session || !isRemoteContext(session.context) || !isSalesCall(session.session_kind ?? "sales")) return null;
    const loaded = await loadLines(admin, sessionId, session.started_at);
    if (!loaded || loaded.lines.length < 2) return null;

    const { data: existing, error: exErr } = await admin
      .from("session_follow_through")
      .select("id")
      .eq("company_id", session.company_id)
      .eq("session_id", sessionId)
      .eq("transcript_version", loaded.version)
      .maybeSingle();
    if (exErr) {
      console.error(`[followThrough] read failed session=${sessionId}: ${exErr.message}`);
      return null; // includes "0281 not applied"
    }
    if (existing) return String(existing.id);

    const callDate = new Date(session.started_at);
    const r = await followThroughCoach({
      companyId: session.company_id,
      systemPrompt: FOLLOW_THROUGH_SYSTEM + CONVERSATION_IS_DATA,
      userMessage: `Call date: ${callDate.toISOString().slice(0, 10)}\n\nTranscript:\n${numberedTranscript(loaded.lines)}`,
      sessionId,
    });
    if (r.suppressed || !r.text.trim()) return null;
    const read = parseFollowThrough(r.text, loaded.lines, callDate);

    // A plain insert: Postgres refuses ON CONFLICT (even DO NOTHING) on a table with an UPDATE rule (0281:44), so
    // the once-per-version guarantee is the unique constraint, and a concurrent writer's row is read back on 23505.
    const { data: row, error } = await admin
      .from("session_follow_through")
      .insert(
        {
          session_id: sessionId,
          company_id: session.company_id,
          rep_id: session.agent_id,
          transcript_version: loaded.version,
          suggested_outcome: read.suggestedOutcome,
          outcome_why: read.why,
          outcome_seq: read.outcomeSeq,
          callbacks: read.callbacks,
        },
      )
      .select("id")
      .maybeSingle();
    if (error?.code === "23505") {
      const { data: raced } = await admin
        .from("session_follow_through")
        .select("id")
        .eq("company_id", session.company_id)
        .eq("session_id", sessionId)
        .eq("transcript_version", loaded.version)
        .maybeSingle();
      return raced ? String(raced.id) : null;
    }
    if (error) {
      console.error(`[followThrough] store failed session=${sessionId}: ${error.message}`);
      return null;
    }
    return row ? String(row.id) : null;
  } catch (err) {
    console.error(`[followThrough] threw session=${sessionId}:`, err);
    return null;
  }
}
