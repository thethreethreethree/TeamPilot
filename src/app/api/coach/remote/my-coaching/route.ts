import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { REMOTE_CONTEXTS } from "@/lib/coach/sessionContext";
import { isRequestOpen, loadCoachingEvents, requestAnsweredAt } from "@/lib/coach/remote/feedback";

/**
 * GET /api/coach/remote/my-coaching — the caller's own week for "Your coaching this week" on Remote Sales → Today
 * (2026-11-23, routine.ts repRoutineSteps; ledger F16.12, the self-coaching half).
 *
 *   answers: { answered, waiting, newestSessionId } | null — the caller's feedback requests (last 30 days): how many
 *            were answered in the last 7 days and NOT yet seen (an answer after the rep's latest view of that call,
 *            feedback_answer_views 0321), and how many are still open. Answered/open is the coaching inbox's own
 *            rule (feedback.ts isRequestOpen / requestAnsweredAt over loadCoachingEvents), so the rep and the manager
 *            never disagree about a request (§2.2).
 *   notes:   { without, newestSessionId } | null — the caller's finished phone/video calls in the last 7 days with no
 *            note written by them (call_notes, 0316).
 * Each part is null when its read failed — a failed read is not "nothing waiting" (§3.4). Only the caller's own rows:
 * every read is pinned to their company and to them as requester / rep / author. Practice comes from assignments.
 */
const DAY = 86_400_000;
const MISSING = new Set(["PGRST205", "42P01"]);

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-my-coaching", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const admin = createAdminClient();
  const now = Date.now();
  const weekAgo = now - 7 * DAY;
  return NextResponse.json({ answers: await answers(admin, ctx, weekAgo, now), notes: await notes(admin, ctx, weekAgo) });
}

type Ctx = { userId: string; companyId: string };
type Admin = ReturnType<typeof createAdminClient>;

async function answers(admin: Admin, ctx: Ctx, weekAgo: number, now: number) {
  const { data, error } = await admin
    .from("feedback_requests")
    .select("session_id, recipient_id, created_at")
    .eq("company_id", ctx.companyId)
    .eq("requester_id", ctx.userId)
    .gte("created_at", new Date(now - 30 * DAY).toISOString())
    .limit(500);
  if (error) {
    if (MISSING.has(String(error.code))) return { answered: 0, waiting: 0, newestSessionId: null };
    console.error(`[my-coaching] request read failed: ${error.message}`);
    return null;
  }
  const rows = (data ?? []) as Array<{ session_id: string; recipient_id: string | null; created_at: string }>;
  if (rows.length === 0) return { answered: 0, waiting: 0, newestSessionId: null };
  let events;
  try {
    events = await loadCoachingEvents(admin, ctx.companyId, [...new Set(rows.map((r) => String(r.session_id)))]);
  } catch (e) {
    console.error(`[my-coaching] coaching read failed: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
  // When the rep last saw each call's answer (0321). Before the migration: never seen (today's behaviour).
  const { data: views, error: vErr } = await admin
    .from("feedback_answer_views")
    .select("session_id, seen_at")
    .eq("company_id", ctx.companyId)
    .eq("rep_id", ctx.userId)
    .in("session_id", [...new Set(rows.map((r) => String(r.session_id)))])
    .limit(1000);
  if (vErr && !MISSING.has(String(vErr.code))) {
    console.error(`[my-coaching] view read failed: ${vErr.message}`);
    return null;
  }
  const lastSeen = new Map<string, number>();
  for (const v of (views ?? []) as Array<{ session_id: string; seen_at: string }>) {
    const t = Date.parse(v.seen_at);
    if (t > (lastSeen.get(String(v.session_id)) ?? 0)) lastSeen.set(String(v.session_id), t);
  }
  let answered = 0;
  let waiting = 0;
  let newest: { at: number; sessionId: string } | null = null;
  for (const r of rows) {
    const request = { sessionId: String(r.session_id), managerId: r.recipient_id, requesterId: ctx.userId, createdAt: new Date(r.created_at) };
    if (isRequestOpen(request, events)) {
      waiting++;
      continue;
    }
    const at = requestAnsweredAt(request, events)?.getTime() ?? 0;
    if (at < weekAgo) continue;
    if ((lastSeen.get(request.sessionId) ?? 0) >= at) continue; // seen since it was answered
    answered++;
    if (!newest || at > newest.at) newest = { at, sessionId: request.sessionId };
  }
  return { answered, waiting, newestSessionId: newest?.sessionId ?? null };
}

async function notes(admin: Admin, ctx: Ctx, weekAgo: number) {
  const { data: calls, error } = await admin
    .from("coaching_sessions")
    .select("id, started_at")
    .eq("company_id", ctx.companyId)
    .eq("agent_id", ctx.userId)
    .in("context", [...REMOTE_CONTEXTS])
    .in("status", ["ended", "reviewed"])
    .gte("started_at", new Date(weekAgo).toISOString())
    .order("started_at", { ascending: false })
    .limit(100); // one week of a rep's calls; keeps the .in() below within the 100-id chunk
  if (error) {
    console.error(`[my-coaching] call read failed: ${error.message}`);
    return null;
  }
  const list = (calls ?? []) as Array<{ id: string; started_at: string }>;
  if (list.length === 0) return { without: 0, newestSessionId: null };
  const { data: noted, error: nErr } = await admin
    .from("call_notes")
    .select("session_id")
    .eq("company_id", ctx.companyId)
    .eq("author_id", ctx.userId)
    .in("session_id", list.map((c) => c.id))
    .limit(1000);
  if (nErr) {
    if (MISSING.has(String(nErr.code))) return null;
    console.error(`[my-coaching] note read failed: ${nErr.message}`);
    return null;
  }
  const has = new Set(((noted ?? []) as Array<{ session_id: string }>).map((n) => String(n.session_id)));
  const without = list.filter((c) => !has.has(String(c.id)));
  return { without: without.length, newestSessionId: without[0]?.id ?? null };
}
