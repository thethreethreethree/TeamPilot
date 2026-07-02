import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import {
  getSession,
  getSessionCuesAdmin,
  appendCueOutcome,
} from "@/lib/data/salesCoach";

/**
 * POST /api/coach/sales-session/[id]/cue-outcome
 *
 * Records the rep's FIRST-PARTY signal that they used (or didn't use) a live
 * cue — the "used it" tap in the live panel. Stored with source='rep_marked'
 * (0080), which the After Pitch Summary prefers over any inference (§3.4 — a
 * rep-confirmed follow is never overwritten by a guess).
 *
 * Owner-gated: only the session's own rep may mark their cues. The cue must
 * belong to this session (guards cross-session marking, since appendCueOutcome
 * writes via the service-role client that bypasses RLS).
 *
 * UNTESTED end-to-end: the live cue pipeline it rides on is itself untested
 * (vendor/hardware-gated). The route + storage are verifiable; the tap→cueId→
 * mark round trip is not, without a real call.
 */

const BodySchema = z.object({
  cueId: z.string().uuid(),
  determination: z.enum(["followed", "partial", "ignored"]).optional(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req, {
    id: "sales-session-cue-outcome",
    windowMs: 60_000,
    max: 120,
  });
  if (limited) return limited;

  const { id } = await context.params;
  const body = await readBody(req, BodySchema);
  if (body instanceof NextResponse) return body;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const session = await getSession(id);
  if (!session) {
    return NextResponse.json(
      { error: "Session not found or not accessible." },
      { status: 404 }
    );
  }
  if (session.agentId !== auth.user.id) {
    return NextResponse.json(
      { error: "Only the session's rep can mark its cues." },
      { status: 403 }
    );
  }

  // The cue must belong to THIS session (appendCueOutcome bypasses RLS).
  const cues = await getSessionCuesAdmin(id);
  if (!cues.some((c) => c.id === body.cueId)) {
    return NextResponse.json(
      { error: "Cue not found for this session." },
      { status: 404 }
    );
  }

  const saved = await appendCueOutcome({
    cueId: body.cueId,
    sessionId: id,
    determination: body.determination ?? "followed",
    source: "rep_marked",
    createdBy: auth.user.id,
  });
  if (!saved) {
    return NextResponse.json(
      { error: "Couldn't record the cue outcome." },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, outcome: saved });
}
