import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveApiUserId } from "@/lib/api/resolveApiAuth";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import {
  getSession,
  setSessionOutcome,
  SALES_OUTCOMES,
  type SalesOutcome,
} from "@/lib/data/salesCoach";
import { notifyDealClosed } from "@/lib/coach/gamification/notify";

/**
 * POST /api/coach/sales-session/[id]/outcome  (Sessions Phase 2)
 *
 * Record the call OUTCOME — the downstream consequence (§3.5). Sets the
 * column (current state) and appends an immutable event (§3.1) via
 * setSessionOutcome. Access is gated by getSession's RLS read: if the caller
 * can see the session (its agent, or their manager), they can record it —
 * coaching data, never a gate. Re-recording appends a correcting event.
 */

const BodySchema = z.object({
  outcome: z.enum(SALES_OUTCOMES as [SalesOutcome, ...SalesOutcome[]]),
  // Optional deal value (Layer-1 KPI, 0205). Omit to leave unchanged; null to clear.
  dealValue: z.number().nonnegative().max(1_000_000_000_000).nullable().optional(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req, {
    id: "sales-session-outcome",
    windowMs: 60_000,
    max: 30,
  });
  if (limited) return limited;

  const { id } = await context.params;
  const body = await readBody(req, BodySchema);
  if (body instanceof NextResponse) return body;

  // Cookie first, then a mobile Bearer token.
  const userId = await resolveApiUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // RLS-scoped read = the access check. Non-null means the caller may see it.
  // A Bearer caller reads through their OWN client so the same RLS policies
  // apply; a cookie caller passes undefined and gets the cookie client exactly
  // as before.
  const session = await getSession(id, callerScopedDb(req) ?? undefined);
  if (!session) {
    return NextResponse.json(
      { error: "Session not found or not accessible." },
      { status: 404 }
    );
  }

  const updated = await setSessionOutcome({
    sessionId: id,
    outcome: body.outcome,
    actorId: userId,
    dealValue: body.dealValue,
  });
  if (!updated) {
    return NextResponse.json(
      { error: "Couldn't record the outcome." },
      { status: 500 }
    );
  }

  // Gamification (Phase 4): a closed deal fans out a manager notification. Best-effort + idempotent (a re-record of
  // 'sold' notifies at most once via the unique index); never blocks the outcome response.
  if (body.outcome === "sold") {
    await notifyDealClosed({
      companyId: session.companyId,
      agentId: session.agentId,
      sessionId: id,
      dealValue: body.dealValue ?? updated.dealValue ?? null,
    });
  }

  return NextResponse.json({ session: updated });
}
