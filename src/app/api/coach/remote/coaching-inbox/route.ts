import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { treeFilterReps } from "@/lib/api/treeAccess";
import { isRequestOpen, listenedSeconds, loadCoachingEvents } from "@/lib/coach/remote/feedback";

/**
 * GET /api/coach/remote/coaching-inbox — the manager's feedback inbox on Coach Assessment (RSS Phase 4, Gong F16.4).
 *
 * One row per feedback request from a rep the caller may see (reporting tree, 0273 — asked through treeFilterReps
 * because this reads with the service role). Columns: rep, call, asked, note, addressed to you or to "my managers",
 * open/answered (derived — feedback.ts closesUnderEveryPolicy), and how much of the call YOU have played (merged
 * listen ranges; a raw measure that needs no D8 decision). Last 90 days, newest first. Filters run in the panel.
 */
const MISSING = new Set(["PGRST205", "42P01"]);
const DAY = 86_400_000;

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-coaching-inbox", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const mgr = await requireSalesCoachManager(req);
  if (!mgr) return NextResponse.json({ error: "Managers only." }, { status: 403 });

  const admin = createAdminClient();
  const { data: reqRows, error } = await admin
    .from("feedback_requests")
    .select("id, session_id, requester_id, recipient_id, message, created_at")
    .eq("company_id", mgr.companyId)
    .gte("created_at", new Date(Date.now() - 90 * DAY).toISOString())
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) {
    if (MISSING.has(String(error.code))) {
      return NextResponse.json({ available: false, reason: "The coaching inbox is waiting on database migration 0278." });
    }
    console.error(`[coaching-inbox] read failed company=${mgr.companyId}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't load the coaching inbox." }, { status: 500 });
  }
  type Row = { id: string; session_id: string; requester_id: string; recipient_id: string | null; message: string | null; created_at: string };
  const all = (reqRows ?? []) as Row[];
  const visible = new Set(await treeFilterReps(req, [...new Set(all.map((r) => String(r.requester_id)))]));
  const rows = all.filter((r) => visible.has(String(r.requester_id)) && String(r.requester_id) !== mgr.userId);
  if (rows.length === 0) return NextResponse.json({ available: true, items: [] });

  const sessionIds = [...new Set(rows.map((r) => String(r.session_id)))];
  const repIds = [...new Set(rows.map((r) => String(r.requester_id)))];

  // A failed coaching read throws (FeedbackReadError): every request would otherwise read as still OPEN.
  let loaded;
  try {
    loaded = await Promise.all([
    admin.from("coaching_sessions").select("id, client_label, context, started_at").eq("company_id", mgr.companyId).in("id", sessionIds),
    admin.from("profiles").select("id, full_name").eq("company_id", mgr.companyId).in("id", repIds),
    loadCoachingEvents(admin, mgr.companyId, sessionIds),
    admin.from("listen_events").select("session_id, from_ms, to_ms").eq("company_id", mgr.companyId).eq("listener_id", mgr.userId).in("session_id", sessionIds),
    ]);
  } catch (e) {
    console.error(`[coaching-inbox] coaching read failed: ${e instanceof Error ? e.message : String(e)}`);
    return NextResponse.json({ error: "Couldn't load the coaching inbox." }, { status: 500 });
  }
  const [{ data: sessions }, { data: reps }, events, { data: listens, error: lErr }] = loaded;
  if (lErr && !MISSING.has(String(lErr.code))) console.error(`[coaching-inbox] listen read failed: ${lErr.message}`);

  const sessionById = new Map(((sessions ?? []) as Array<{ id: string; client_label: string | null; context: string; started_at: string }>).map((s) => [String(s.id), s]));
  const nameById = new Map(((reps ?? []) as Array<{ id: string; full_name: string | null }>).map((p) => [String(p.id), p.full_name]));
  const rangesBySession = new Map<string, [number, number][]>();
  for (const l of (listens ?? []) as Array<{ session_id: string; from_ms: number; to_ms: number }>) {
    const k = String(l.session_id);
    rangesBySession.set(k, [...(rangesBySession.get(k) ?? []), [Number(l.from_ms), Number(l.to_ms)]]);
  }

  const items = rows.map((r) => {
    const s = sessionById.get(String(r.session_id));
    return {
      id: r.id,
      sessionId: r.session_id,
      repId: r.requester_id,
      repName: nameById.get(String(r.requester_id)) ?? null,
      callLabel: s?.client_label ?? null,
      context: s?.context ?? null,
      callStartedAt: s?.started_at ?? null,
      askedAt: r.created_at,
      message: r.message,
      toYou: r.recipient_id === null || r.recipient_id === mgr.userId,
      toNamedManager: r.recipient_id !== null,
      open: isRequestOpen(
        { sessionId: String(r.session_id), managerId: r.recipient_id, requesterId: String(r.requester_id), createdAt: new Date(r.created_at) },
        events,
      ),
      youListenedSeconds: Math.round(listenedSeconds(rangesBySession.get(String(r.session_id)) ?? [])),
    };
  });
  return NextResponse.json({ available: true, items });
}
