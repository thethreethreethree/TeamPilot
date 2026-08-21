import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { getSession, setSessionStatus } from "@/lib/data/salesCoach";
import { resolveCoachingMode } from "@/lib/coach/strategy/resolveCoachingMode";

/**
 * POST /api/coach/meeting-session/[id]/end — mark a meeting/huddle session ENDED on Stop.
 *
 * Without this, a Stopped meeting lingers status='active' until the 6h auto-close-stale cron closes it — and the
 * 0070 trigger then stamps ended_at ~6h after start, giving a wildly wrong meeting DURATION (started..ended). The
 * client calls this on Stop so ended_at is stamped ≈ now. Owner-gated (the facilitator's own meeting); idempotent
 * (only transitions an 'active' session, so a double-tap / a session already closed by the cron is a no-op).
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "meeting-session-end", windowMs: 60_000, max: 30 });
  if (limited) return limited;

  const { id } = await context.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const companyId = (await getCurrentCompanyId()) ?? undefined;
  if (!companyId) return NextResponse.json({ error: "No company context." }, { status: 403 });

  const session = await getSession(id);
  if (!session) return NextResponse.json({ error: "Session not found or not accessible." }, { status: 404 });
  if (session.agentId !== auth.user.id) {
    return NextResponse.json({ error: "Only the session's facilitator can end it." }, { status: 403 });
  }
  if (resolveCoachingMode(session.sessionKind) === "sales") {
    return NextResponse.json({ error: "This session is not a meeting or huddle." }, { status: 400 });
  }
  // Already ended (a double-tap, or the cron got here first) → no-op, don't re-stamp ended_at.
  if (session.status !== "active") return NextResponse.json({ ok: true, alreadyEnded: true });

  const updated = await setSessionStatus({ sessionId: id, status: "ended", actorId: auth.user.id });
  if (!updated) return NextResponse.json({ error: "Couldn't end the session." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
