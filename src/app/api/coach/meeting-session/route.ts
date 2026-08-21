import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { createSession } from "@/lib/data/salesCoach";

/**
 * Meeting Coach (Team-Sync) — session collection. Sibling of the sales-session create route, re-aimed at
 * meetings/huddles. A meeting session IS a coaching_sessions row with `session_kind` set (migration 0237);
 * `context` (in_person|video) still applies — a meeting happens in a room or on a call. The facilitator is the
 * current user; the company is theirs.
 *
 * POST → open a new meeting/huddle session for the current facilitator.
 */
const CreateSchema = z.object({
  // The coaching kind — drives which brain (meeting = facilitation depth; huddle = tighter/status).
  kind: z.enum(["meeting", "huddle"]),
  // Where it happens (same axis as sales); frames attribution (room mic vs per-participant captions).
  context: z.enum(["in_person", "video"]),
  // A title, required before the session begins (mirrors sales — an untitled session is ambiguous in history).
  title: z.string().trim().min(1).max(200),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "meeting-session-create", windowMs: 60_000, max: 30 });
  if (limited) return limited;

  const body = await readBody(req, CreateSchema);
  if (body instanceof NextResponse) return body;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const companyId = (await getCurrentCompanyId()) ?? undefined;
  if (!companyId) return NextResponse.json({ error: "No company context." }, { status: 403 });

  const session = await createSession({
    companyId,
    agentId: auth.user.id,
    context: body.context,
    clientLabel: body.title,
    sessionKind: body.kind,
  });
  if (!session) {
    // createSession returns null if the insert failed — most likely migration 0237 isn't applied yet (the
    // session_kind column is absent), which is a blocking setup step, not a user error. Fail honestly (A34).
    return NextResponse.json(
      { error: "Couldn't start the meeting session. If this persists, migration 0237 may not be applied." },
      { status: 500 }
    );
  }
  return NextResponse.json({ session });
}
