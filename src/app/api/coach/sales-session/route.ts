import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
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
  });
  if (!session) {
    return NextResponse.json(
      { error: "Couldn't start the session." },
      { status: 500 }
    );
  }
  return NextResponse.json({ session });
}

export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const sessions = await listAgentSessions(auth.user.id);
  return NextResponse.json({ sessions });
}
