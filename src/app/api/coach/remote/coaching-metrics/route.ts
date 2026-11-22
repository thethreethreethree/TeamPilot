import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPagedResult } from "@/lib/supabase/paginate";
import { conversationDurationSeconds } from "@/lib/coach/conversationDuration";
import { rateLimit } from "@/lib/api/rateLimit";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { treeFilterReps } from "@/lib/api/treeAccess";
import { FEEDBACK_POLICY, LISTENED_THRESHOLD } from "@/lib/coach/remote/decisions";
import { countsAsFeedback, counted, loadCoachingEvents } from "@/lib/coach/remote/feedback";

/**
 * GET /api/coach/remote/coaching-metrics — per-manager coaching activity, last 30 days (RSS Phase 4, Gong F16.2).
 *
 * D8 GATE. What counts as "feedback given" and as "listened" is NOT DECIDED (decisions.ts). Until both are, this
 * answers 409 with the decision's name, and the panel shows that line — never a number computed under a guessed
 * rule (docs/00-OPEN-DECISIONS.md). When D8 is set, the same route computes:
 *   feedbackGiven — events countsAsFeedback() accepts, by manager, on sessions of reps the caller may see;
 *   callsListened — sessions whose merged listen ranges pass counted(), by listener.
 */
const DAY = 86_400_000;

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-coaching-metrics", windowMs: 60_000, max: 30 });
  if (limited) return limited;
  const mgr = await requireSalesCoachManager(req);
  if (!mgr) return NextResponse.json({ error: "Managers only." }, { status: 403 });

  if (FEEDBACK_POLICY === "NOT DECIDED" || LISTENED_THRESHOLD === "NOT DECIDED") {
    return NextResponse.json(
      {
        decided: false,
        decision: "D8",
        reason: "Coaching metrics wait on one decision: what counts as feedback given, and how much of a call counts as listened.",
      },
      { status: 409 },
    );
  }

  const admin = createAdminClient();
  // Gong F16.9: coaching is counted by WHEN IT HAPPENED (the last 30 days), not by when the call started — a manager
  // who reviews a six-week-old call today is coaching today. Calls are looked up over a bounded 180 days.
  const since = new Date(Date.now() - 30 * DAY).toISOString();
  const callsSince = new Date(Date.now() - 180 * DAY).toISOString();
  type S = { id: string; agent_id: string; started_at: string; ended_at: string | null; audio_duration_seconds: number | null };
  // Every session in the window: PostgREST caps a read at 1000, and a capped read would undercount silently.
  const { data: sessions, error } = await fetchAllPagedResult<S>(
    (from, to) =>
      admin
        .from("coaching_sessions")
        .select("id, agent_id, started_at, ended_at, audio_duration_seconds")
        .eq("company_id", mgr.companyId)
        .in("context", ["phone", "video"])
        .gte("started_at", callsSince)
        .order("started_at", { ascending: true })
        .range(from, to),
    { label: "coaching-metrics sessions", maxRows: 50_000 },
  );
  if (error) {
    console.error(`[coaching-metrics] session read failed company=${mgr.companyId}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't load coaching metrics." }, { status: 500 });
  }
  const all = sessions ?? [];
  const allowed = new Set(await treeFilterReps(req, [...new Set(all.map((s) => String(s.agent_id)))]));
  const mine = all.filter((s) => allowed.has(String(s.agent_id)));
  const ids = mine.map((s) => String(s.id));

  const feedbackGiven: Record<string, number> = {};
  // In chunks: 180 days of calls is too many ids for one URL (loadCoachingEvents and the listen read put them in .in()).
  const CHUNK = 150;
  const events = [];
  try {
    for (let i = 0; i < ids.length; i += CHUNK) events.push(...(await loadCoachingEvents(admin, mgr.companyId, ids.slice(i, i + CHUNK))));
  } catch (e) {
    // A failed read is an error, never "no feedback given".
    console.error(`[coaching-metrics] coaching read failed company=${mgr.companyId}: ${e instanceof Error ? e.message : String(e)}`);
    return NextResponse.json({ error: "Couldn't load coaching metrics." }, { status: 500 });
  }
  for (const e of events) {
    if ("managerId" in e && e.at.toISOString() >= since && countsAsFeedback(e)) feedbackGiven[e.managerId] = (feedbackGiven[e.managerId] ?? 0) + 1;
  }

  const lengthMs = new Map(
    mine.map((s) => [
      String(s.id),
      // The one length authority: audio when known, else a capped wall-clock span (an unclosed session is unknown, 0).
      (conversationDurationSeconds(s.audio_duration_seconds, s.started_at, s.ended_at) ?? 0) * 1000,
    ]),
  );
  const listens: Array<{ session_id: string; listener_id: string; rep_id: string; from_ms: number; to_ms: number }> = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error: lErr } = await admin
      .from("listen_events")
      .select("session_id, listener_id, rep_id, from_ms, to_ms")
      .eq("company_id", mgr.companyId)
      .in("session_id", ids.slice(i, i + CHUNK))
      .gte("created_at", since);
    if (lErr) {
      console.error(`[coaching-metrics] listen read failed company=${mgr.companyId}: ${lErr.message}`);
      return NextResponse.json({ error: "Couldn't load coaching metrics." }, { status: 500 });
    }
    listens.push(...((data ?? []) as typeof listens));
  }
  const ranges = new Map<string, [number, number][]>();
  for (const l of listens) {
    if (l.listener_id === l.rep_id) continue; // a rep replaying their own call is not a manager listening
    const k = `${l.listener_id}|${l.session_id}`;
    ranges.set(k, [...(ranges.get(k) ?? []), [Number(l.from_ms), Number(l.to_ms)]]);
  }
  const callsListened: Record<string, number> = {};
  for (const [k, r] of ranges) {
    const [listener, session] = k.split("|");
    if (!listener || !session) continue;
    if (counted(r, lengthMs.get(session) ?? 0)) callsListened[listener] = (callsListened[listener] ?? 0) + 1;
  }
  return NextResponse.json({ decided: true, since, sessions: ids.length, feedbackGiven, callsListened });
}
