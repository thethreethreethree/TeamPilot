import { NextRequest, NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit/recordAudit";
import { toCsv } from "@/lib/export/toCsv";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPagedResult } from "@/lib/supabase/paginate";
import { conversationDurationSeconds } from "@/lib/coach/conversationDuration";
import { rateLimit } from "@/lib/api/rateLimit";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { treeFilterReps } from "@/lib/api/treeAccess";
import { FEEDBACK_POLICY, LISTENED_THRESHOLD } from "@/lib/coach/remote/decisions";
import { countsAsFeedback, counted, loadCoachingEvents, coachingByRep } from "@/lib/coach/remote/feedback";

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
  type S = { id: string; agent_id: string; started_at: string; ended_at: string | null; audio_duration_seconds: number | null; client_label: string | null };
  // Every session in the window: PostgREST caps a read at 1000, and a capped read would undercount silently.
  const { data: sessions, error } = await fetchAllPagedResult<S>(
    (from, to) =>
      admin
        .from("coaching_sessions")
        .select("id, agent_id, started_at, ended_at, audio_duration_seconds, client_label")
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
  // F16.8 (2026-11-25): beside the count of feedback, how many CALLS got feedback, and how many got a comment sent to
  // the rep — distinct calls per manager, same events and D8 rule, same 30 days.
  const feedbackCalls: Record<string, Set<string>> = {};
  const commentCalls: Record<string, Set<string>> = {};
  for (const e of events) {
    if (!("managerId" in e) || e.at.toISOString() < since || !countsAsFeedback(e)) continue;
    feedbackGiven[e.managerId] = (feedbackGiven[e.managerId] ?? 0) + 1;
    if ("sessionId" in e) {
      (feedbackCalls[e.managerId] ??= new Set()).add(e.sessionId);
      if (e.kind === "comment_sent_to_rep") (commentCalls[e.managerId] ??= new Set()).add(e.sessionId);
    }
  }
  const callsWithFeedback = Object.fromEntries(Object.entries(feedbackCalls).map(([k, v]) => [k, v.size]));
  const callsWithComments = Object.fromEntries(Object.entries(commentCalls).map(([k, v]) => [k, v.size]));

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
  // Coaching by rep (2026-11-25, ledger F16.5): one row per rep this manager may see — from the SAME calls and events
  // as the numbers above, plus their open feedback requests and names. The manager's own calls are not a rep's row.
  const repIds = [...allowed].filter((id) => id !== mgr.userId);
  let byRep: ReturnType<typeof coachingByRep> = [];
  if (repIds.length) {
    const [{ data: profs, error: nErr }, { data: reqs, error: rErr }] = await Promise.all([
      admin.from("profiles").select("id, full_name").eq("company_id", mgr.companyId).in("id", repIds),
      admin.from("feedback_requests").select("session_id, requester_id, recipient_id, created_at").eq("company_id", mgr.companyId).in("requester_id", repIds).gte("created_at", since),
    ]);
    if (nErr || rErr) {
      console.error(`[coaching-metrics] by-rep read failed company=${mgr.companyId}: ${(nErr ?? rErr)!.message}`);
      return NextResponse.json({ error: "Couldn't load coaching metrics." }, { status: 500 });
    }
    const names = new Map(((profs ?? []) as Array<{ id: string; full_name: string | null }>).map((p) => [String(p.id), p.full_name ?? "Unnamed teammate"]));
    // A recent request can be about a call older than the 180 days read above; load that call's coaching too, or its
    // answer is never seen and the request counts as open forever (review 2026-11-25).
    const inView = new Set(ids);
    const extra = [...new Set(((reqs ?? []) as Array<{ session_id: string }>).map((r) => String(r.session_id)))].filter((id) => !inView.has(id));
    const requestEvents = [...events];
    try {
      for (let i = 0; i < extra.length; i += CHUNK) requestEvents.push(...(await loadCoachingEvents(admin, mgr.companyId, extra.slice(i, i + CHUNK))));
    } catch (e) {
      console.error(`[coaching-metrics] request-call coaching read failed company=${mgr.companyId}: ${e instanceof Error ? e.message : String(e)}`);
      return NextResponse.json({ error: "Couldn't load coaching metrics." }, { status: 500 });
    }
    byRep = coachingByRep({
      reps: repIds.map((id) => ({ id, name: names.get(id) ?? "Unnamed teammate" })),
      calls: mine.map((s) => ({ id: String(s.id), repId: String(s.agent_id), startedAt: s.started_at, label: s.client_label ?? null })),
      events: requestEvents,
      requests: ((reqs ?? []) as Array<{ session_id: string; requester_id: string; recipient_id: string | null; created_at: string }>).map((r) => ({
        sessionId: String(r.session_id),
        managerId: r.recipient_id,
        requesterId: String(r.requester_id),
        createdAt: new Date(r.created_at),
      })),
      now: new Date(),
    });
  }

  // Coaching export (2026-11-23; ledger F16.11): the same numbers as a CSV, one row per person, audited like every
  // coaching export (the audit-route invariant). Same computation as the panel, so the file can't disagree with it.
  if (new URL(req.url).searchParams.get("format") === "csv") {
    const people = [...new Set([...Object.keys(feedbackGiven), ...Object.keys(callsListened)])];
    const { data: profs, error: pErr } = people.length
      ? await admin.from("profiles").select("id, full_name").eq("company_id", mgr.companyId).in("id", people)
      : { data: [], error: null };
    if (pErr) {
      console.error(`[coaching-metrics] names read failed company=${mgr.companyId}: ${pErr.message}`);
      return NextResponse.json({ error: "Couldn't build the export." }, { status: 500 });
    }
    const nameOf = new Map(((profs ?? []) as Array<{ id: string; full_name: string | null }>).map((p) => [p.id, p.full_name]));
    const rows = people
      .map((id) => ({ person: nameOf.get(id) ?? "Unnamed teammate", feedback_given: feedbackGiven[id] ?? 0, calls_with_feedback: callsWithFeedback[id] ?? 0, calls_with_comments: callsWithComments[id] ?? 0, calls_listened: callsListened[id] ?? 0, period_start: since.slice(0, 10), period_end: new Date().toISOString().slice(0, 10) }))
      .sort((a, b) => a.person.localeCompare(b.person));
    await recordAudit(admin, { companyId: mgr.companyId, actorId: mgr.userId, action: "session.export", objectType: "company", objectId: mgr.companyId, meta: { kind: "coaching_metrics", rows: rows.length } });
    return new NextResponse(toCsv(rows, ["person", "feedback_given", "calls_with_feedback", "calls_with_comments", "calls_listened", "period_start", "period_end"]), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="coaching-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }
  return NextResponse.json({ decided: true, since, sessions: ids.length, feedbackGiven, callsWithFeedback, callsWithComments, callsListened, byRep });
}
