import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPagedResult } from "@/lib/supabase/paginate";
import { extractSessionSignals } from "@/lib/coach/v5/sessionFlag";

/**
 * Deal sentiment (2026-11-23; gong.io capture M36 "Sentiment analysis … AI flags at-risk deals from sentiment",
 * graded PARTIAL: per-call warming/cooling exists, nothing on the deal). Composed from what each call already has —
 * the timeline's net customer sentiment (coach.session_moments_generated → netSentimentFromMoments via
 * extractSessionSignals, the same reading the session flags use, §2.2) — across the calls linked to a prospect.
 *
 *   last  = the net sentiment of the prospect's most recent call that has a reading
 *   trend = that reading against the one before: warming (better), cooling (worse), steady, or null with one call
 */
export type Reading = "warming" | "cooling" | "flat";
export type DealSentiment = { last: Reading; trend: "warming" | "cooling" | "steady" | null; calls: number };

const SCORE: Record<Reading, number> = { cooling: -1, flat: 0, warming: 1 };

/** Pure: readings in time order (oldest first) → the deal's sentiment, or null with no reading at all. */
export function dealSentimentFrom(readings: Reading[]): DealSentiment | null {
  if (!readings.length) return null;
  const last = readings[readings.length - 1]!;
  if (readings.length === 1) return { last, trend: null, calls: 1 };
  const prev = readings[readings.length - 2]!;
  const d = SCORE[last] - SCORE[prev];
  return { last, trend: d > 0 ? "warming" : d < 0 ? "cooling" : "steady", calls: readings.length };
}

/**
 * Each prospect's deal sentiment, read through the CALLER's client (events are company-scoped; the sessions come from
 * links the caller can already see). Null on any failed read — the caller treats that as a failed pipeline read.
 */
export async function readDealSentiment(db: SupabaseClient, prospectIds: string[]): Promise<Map<string, DealSentiment> | null> {
  const out = new Map<string, DealSentiment>();
  if (!prospectIds.length) return out;
  // In chunks of 150 prospects (2026-11-26: the list is no longer capped at 500, so one .in() could outgrow the URL).
  const rows: Array<{ prospect_id: string; session_id: string }> = [];
  for (let i = 0; i < prospectIds.length; i += 150) {
    const links = await fetchAllPagedResult<{ prospect_id: string; session_id: string }>(
      (from, to) => db.from("remote_prospect_calls").select("prospect_id, session_id").in("prospect_id", prospectIds.slice(i, i + 150)).order("id", { ascending: true }).range(from, to),
      { label: "deal sentiment links" },
    );
    if (links.error) return null;
    rows.push(...(links.data ?? []));
  }
  if (!rows.length) return out;
  const subjects = [...new Set(rows.map((l) => `sales_session:${l.session_id}`))];
  // In batches of 100 calls, so a large pipeline never builds a request URL the API refuses.
  const events: Array<{ subject: string; payload: unknown; created_at: string; id: string }> = [];
  for (let i = 0; i < subjects.length; i += 100) {
    const chunk = subjects.slice(i, i + 100);
    const ev = await fetchAllPagedResult<{ subject: string; payload: unknown; created_at: string; id: string }>(
      (from, to) =>
        db
          .from("events")
          .select("subject, payload, created_at, id")
          .eq("kind", "coach.session_moments_generated")
          .in("subject", chunk)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, to),
      { label: "deal sentiment moments" },
    );
    if (ev.error) return null;
    events.push(...(ev.data ?? []));
  }
  events.sort((a, b) => b.created_at.localeCompare(a.created_at) || String(b.id).localeCompare(String(a.id)));
  // Latest moments per call, and when that call was read (its moments' time orders the calls).
  const bySession = new Map<string, { reading: Reading | null; at: string }>();
  for (const e of events) {
    const sid = String(e.subject).replace("sales_session:", "");
    if (bySession.has(sid)) continue;
    const s = extractSessionSignals({ outcome: null, pivotPayload: null, momentsPayload: e.payload }).sentiment;
    bySession.set(sid, { reading: s, at: e.created_at });
  }
  for (const pid of prospectIds) {
    const readings = rows
      .filter((l) => l.prospect_id === pid)
      .map((l) => bySession.get(l.session_id))
      .filter((x): x is { reading: Reading; at: string } => !!x && x.reading !== null)
      .sort((a, b) => a.at.localeCompare(b.at))
      .map((x) => x.reading);
    const d = dealSentimentFrom(readings);
    if (d) out.set(pid, d);
  }
  return out;
}
