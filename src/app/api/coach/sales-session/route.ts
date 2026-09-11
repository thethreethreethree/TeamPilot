import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { sessionStartedAt } from "@/lib/coach/v5/sessionStartedAt";
import { createSession, listAgentSessions } from "@/lib/data/salesCoach";

/**
 * Live Sales Coach — session collection.
 *
 * POST  → open a new coaching session for the current agent.
 * GET   → list the current agent's sessions (most recent first).
 *
 * The agent is always the current user; the company is their company.
 * The realtime audio pipeline (subsystem 1, later) will open sessions
 * the same way once it exists.
 */

const CreateSchema = z.object({
  context: z.enum(["in_person", "video"]),
  // Required (founder 2026-07-01): every session must be titled before it can
  // begin — an untitled session creates initial ambiguity in the history.
  clientLabel: z.string().trim().min(1).max(200),
  // Phase 2 capture, all OPTIONAL (only the title is required). when =
  // started_at; where/how/what entered up front; why is derived (Phase 3).
  territory: z.string().trim().max(200).optional(), // WHERE
  approach: z.string().trim().max(200).optional(), // HOW
  offer: z.string().trim().max(500).optional(), // WHAT
  /**
   * WHEN the conversation happened, for a caller that is not creating the session as it starts.
   *
   * The phone is that caller: a recording is held on the device until there is signal, so this
   * route is reached at UPLOAD. Without this, a call recorded on the 4th and sent on the 11th
   * became a session dated the 11th, and the rep's own history said the conversation happened on
   * a day it did not.
   *
   * Accepted loosely here and judged in `sessionStartedAt` — the shape is a string, the question
   * of whether to believe it is a rule with a reason and belongs in one tested place.
   */
  startedAt: z.string().trim().max(40).optional(),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "sales-session-create",
    windowMs: 60_000,
    max: 30,
  });
  if (limited) return limited;

  const body = await readBody(req, CreateSchema);
  if (body instanceof NextResponse) return body;

  // Cookie first, then a mobile Bearer token. The client this used to build was
  // only ever used for the auth check above — every write below goes through the
  // data layer, which brings its own client.
  const ctx = await resolveApiAuth(req);
  if (!ctx) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const companyId = ctx.companyId;

  const session = await createSession({
    companyId,
    agentId: ctx.userId,
    context: body.context,
    clientLabel: body.clientLabel,
    territory: body.territory || null,
    approach: body.approach || null,
    offer: body.offer || null,
    // Null when the claim is not believable — a phone's clock can be anything, and the fallback is
    // the column default, which is exactly the behaviour that existed before this field.
    startedAt: sessionStartedAt(body.startedAt, new Date()),
  });
  if (!session) {
    return NextResponse.json(
      { error: "Couldn't start the session." },
      { status: 500 }
    );
  }
  return NextResponse.json({ session });
}

// TAKES THE REQUEST, and did not before. `export async function GET()` cannot see
// an Authorization header even in principle, so this route could never have
// answered a mobile caller. The app happens not to call it - it reads sessions
// straight from Supabase - so this is a trap rather than a live bug, and it is
// closed here rather than left for whoever wires it up next.
export async function GET(req: NextRequest) {
  const supabase = callerScopedDb(req) ?? (await createClient());
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  // The scoped client goes THROUGH, not just to auth.getUser(). Resolving it and then reading without
  // it is the defect this route's own comment above was written about.
  const sessions = await listAgentSessions(auth.user.id, 50, supabase);
  return NextResponse.json({ sessions });
}
