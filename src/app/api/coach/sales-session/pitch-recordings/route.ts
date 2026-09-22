import { NextRequest, NextResponse } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { readPitchRecordings, readPitchRecordingDetail } from "@/lib/coach/recordings/readRecordings";
import { shareState, type ShareEvent } from "@/lib/coach/recordings/shareState";

/**
 * GET /api/coach/sales-session/pitch-recordings?repId=…            → the list (guide Step 4 item 1)
 * GET /api/coach/sales-session/pitch-recordings?pitchId=…          → one recording (items 3, 4, 5, 7)
 *
 * THE NAME IS `pitch-recordings`, NOT `recordings`, AND THAT IS A CORRECTION ON THE RECORD.
 * `/api/coach/sales-session/recordings` ALREADY EXISTS and is a different feature: the Sessions
 * tab's list of coaching-session audio, gated by `?agentId` with its own tested manager check.
 * This build overwrote it before noticing — the exact A21 shape (same name, different feature,
 * across modules), caught by that route's own test file rather than by the author. Restored from
 * HEAD and moved here. `readRecordings.ts` renamed its exported row type to `PitchRecordingRow`
 * for the same reason: the other route declares a local `RecordingRow` meaning a session.
 *
 * NOT MANAGER-GATED, deliberately, and this is the one route in Project 4 where that is the right
 * answer. The Coach Assessment dashboard is gated because it exists to compare people and does a
 * cross-person name lookup. This route returns a rep's own recordings and their own transcript —
 * it is the read A10 requires the rep to have. RLS is the access rule (own row, or company
 * manager), and a rep asking for a colleague's repId gets an empty list from the policy rather
 * than a 403 from a second, drifting copy of the same rule (§2.2).
 *
 * The consequence to keep in mind: `repId` is NOT trusted as an authorisation claim anywhere
 * below. It is a filter. The policy decides.
 */
export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "coach-pitch-recordings", windowMs: 60_000, max: 120 });
  if (limited) return limited;

  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Sign in to view recordings." }, { status: 401 });

  const supabase = callerScopedDb(req) ?? (await createClient());
  const pitchId = req.nextUrl.searchParams.get("pitchId");

  if (pitchId) {
    const detail = await readPitchRecordingDetail({ pitchId }, supabase);
    if (!detail) {
      // Indistinguishable from "not yours" on purpose: RLS returns no row either way, and a
      // 404-vs-403 split here would tell a caller whether a pitch id exists in another company.
      return NextResponse.json({ error: "Recording not found." }, { status: 404 });
    }

    // The team-example permission, replayed from its log. Returned as the verdict the button
    // branches on; no surface re-decides whether a revocation counted (§2.2).
    const { data: shareRows } = await supabase
      .from("recording_share_events")
      .select("kind, actor_id, note, created_at")
      .eq("pitch_id", pitchId)
      .order("created_at", { ascending: true });

    const share = shareState(
      ((shareRows ?? []) as Array<Record<string, unknown>>).map(
        (r): ShareEvent => ({
          kind: r.kind as ShareEvent["kind"],
          actorId: String(r.actor_id),
          note: (r.note as string | null) ?? null,
          createdAt: String(r.created_at),
        })
      )
    );

    return NextResponse.json({ ...detail, share, viewerId: ctx.userId });
  }

  const repId = req.nextUrl.searchParams.get("repId") ?? ctx.userId;
  const list = await readPitchRecordings({ repId }, supabase);
  if (list === null) {
    // Never an empty list standing in for a failed read. "No recordings yet" and "we could not
    // load them" send a manager to two different places, and only one of them is the rep.
    return NextResponse.json({ error: "Could not load recordings." }, { status: 500 });
  }

  return NextResponse.json({ ...list, repId, viewerId: ctx.userId });
}
