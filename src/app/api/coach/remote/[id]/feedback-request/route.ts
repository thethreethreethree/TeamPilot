import { NextRequest, NextResponse } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { getSession } from "@/lib/data/salesCoach";
import { isRemoteContext } from "@/lib/coach/sessionContext";
import { isRequestOpen, loadCoachingEvents } from "@/lib/coach/remote/feedback";
import { notifyFeedbackRequested } from "@/lib/coach/gamification/notify";

/**
 * /api/coach/remote/:id/feedback-request — a rep asks for feedback on their own phone/video call (RSS Phase 4,
 * Gong F16.1; migration 0278).
 *
 *   GET  → { available, requests: [{ id, createdAt, message, open }] } for this session (button state).
 *   POST { message? } → stores the request, rings the bell (0279), returns it.
 *
 * WHO MAY ASK. Only the session's own rep (getSession through the caller's client proves they can see it; the
 * agent id proves it is theirs), only on a finished phone/video call (D1). One open request per call: asking
 * again while one is open is refused with the reason, so a manager is not stacked with the same ask.
 *
 * TO WHOM. The rep's manager_id when set; otherwise null = "my managers" (0278 header). Read with the service
 * role, pinned to the company (INV29); a missing column (0272 not applied) means null, today's behaviour.
 *
 * Open/closed is derived (feedback.ts closesUnderEveryPolicy), never stored.
 */
const MISSING = new Set(["PGRST205", "42P01", "42703", "PGRST204"]);

async function readRequests(companyId: string, sessionId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("feedback_requests")
    .select("id, requester_id, recipient_id, message, created_at")
    .eq("company_id", companyId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) return { error, requests: [] };
  const rows = (data ?? []) as Array<{ id: string; requester_id: string; recipient_id: string | null; message: string | null; created_at: string }>;
  let events: Awaited<ReturnType<typeof loadCoachingEvents>> = [];
  try {
    events = rows.length ? await loadCoachingEvents(admin, companyId, [sessionId]) : [];
  } catch (e) {
    // Never "open" because the answer couldn't be read.
    return { error: { code: "FEEDBACK_READ", message: e instanceof Error ? e.message : String(e) }, requests: [] };
  }
  return {
    error: null,
    requests: rows.map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      message: r.message,
      toNamedManager: r.recipient_id !== null,
      open: isRequestOpen(
        { sessionId, managerId: r.recipient_id, requesterId: r.requester_id, createdAt: new Date(r.created_at) },
        events,
      ),
    })),
  };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "remote-feedback-request-read", windowMs: 60_000, max: 120 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;
  const session = await getSession(id, callerScopedDb(req) ?? (await createClient()));
  if (!session) return NextResponse.json({ error: "Session not found or not accessible." }, { status: 404 });

  const read = await readRequests(session.companyId, id);
  if (read.error) {
    if (MISSING.has(String(read.error.code))) {
      return NextResponse.json({ available: false, reason: "Feedback requests are waiting on database migration 0278." });
    }
    console.error(`[feedback-request] read failed session=${id}: ${read.error.message}`);
    return NextResponse.json({ error: "Couldn't load feedback requests." }, { status: 500 });
  }
  return NextResponse.json({ available: true, mine: session.agentId === ctx.userId, requests: read.requests });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "remote-feedback-request", windowMs: 60_000, max: 10 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;

  let body: { message?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const message = typeof body.message === "string" && body.message.trim() ? body.message.trim() : null;
  if (message && message.length > 2000) {
    return NextResponse.json({ error: "Keep the note under 2000 characters." }, { status: 400 });
  }

  const session = await getSession(id, callerScopedDb(req) ?? (await createClient()));
  if (!session) return NextResponse.json({ error: "Session not found or not accessible." }, { status: 404 });
  if (session.agentId !== ctx.userId) {
    return NextResponse.json({ error: "Only the rep on this call can ask for feedback on it." }, { status: 403 });
  }
  if (!isRemoteContext(session.context)) {
    return NextResponse.json({ error: "Feedback requests are for phone and video calls." }, { status: 400 });
  }
  if (session.status === "active") {
    return NextResponse.json({ error: "Finish the call first, then ask for feedback." }, { status: 409 });
  }

  const existing = await readRequests(session.companyId, id);
  if (existing.error) {
    if (MISSING.has(String(existing.error.code))) {
      return NextResponse.json({ error: "Feedback requests are waiting on database migration 0278." }, { status: 503 });
    }
    console.error(`[feedback-request] read failed session=${id}: ${existing.error.message}`);
    return NextResponse.json({ error: "Couldn't check earlier requests." }, { status: 500 });
  }
  if (existing.requests.some((r) => r.open)) {
    return NextResponse.json({ error: "You've already asked for feedback on this call — it's still open." }, { status: 409 });
  }

  const admin = createAdminClient();
  let recipientId: string | null = null;
  let repName: string | null = null;
  {
    const { data, error } = await admin
      .from("profiles")
      .select("full_name, manager_id")
      .eq("company_id", session.companyId)
      .eq("id", ctx.userId)
      .maybeSingle();
    if (!error && data) {
      recipientId = (data.manager_id as string | null) ?? null;
      repName = (data.full_name as string | null) ?? null;
    } else if (error && MISSING.has(String(error.code))) {
      const { data: d2 } = await admin
        .from("profiles")
        .select("full_name")
        .eq("company_id", session.companyId)
        .eq("id", ctx.userId)
        .maybeSingle();
      repName = (d2?.full_name as string | null) ?? null;
    }
  }

  const { data: inserted, error } = await admin
    .from("feedback_requests")
    .insert({ company_id: session.companyId, session_id: id, requester_id: ctx.userId, recipient_id: recipientId, message })
    .select("id, created_at")
    .maybeSingle();
  if (error || !inserted) {
    if (error && MISSING.has(String(error.code))) {
      return NextResponse.json({ error: "Feedback requests are waiting on database migration 0278." }, { status: 503 });
    }
    console.error(`[feedback-request] insert failed session=${id}: ${error?.message ?? "no row"}`);
    return NextResponse.json({ error: "Couldn't send the request." }, { status: 500 });
  }

  const notified = await notifyFeedbackRequested({
    companyId: session.companyId,
    repId: ctx.userId,
    repName,
    sessionId: id,
    recipientId,
    message,
  });
  return NextResponse.json({
    request: { id: inserted.id, createdAt: inserted.created_at, message, toNamedManager: recipientId !== null, open: true },
    notified,
  });
}
