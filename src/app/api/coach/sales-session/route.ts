import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
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

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const companyId = (await getCurrentCompanyId()) ?? undefined;
  if (!companyId) {
    return NextResponse.json({ error: "No company context." }, { status: 403 });
  }

  const session = await createSession({
    companyId,
    agentId: auth.user.id,
    context: body.context,
    clientLabel: body.clientLabel,
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
