import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { rateLimit } from "@/lib/api/rateLimit";
import { readPitchPeriod } from "@/lib/coach/pitchScore/readPitchPeriod";
import { aggregatePitches } from "@/lib/coach/pitchScore/aggregate";

/**
 * GET /api/coach/sales-session/pitch-score/breakdown?period=week[&repId=]
 *
 * The rubric averages behind a rep's Breakdown board.
 *
 * NO EXPLICIT ROLE GATE, AND THAT IS DELIBERATE — the access rule is RLS on `pitches`, read
 * through the caller's own client. A rep sees their own scores; a manager sees their company's.
 * Copying a role check in here would be a SECOND expression of a decision the policy already
 * makes (§2.2), and the copy is the one that drifts.
 *
 * `repId` therefore needs no permission check of its own. A rep who passes a colleague's id gets
 * an empty period, because RLS returns them nothing — not because this route judged them.
 *
 * WHY THE AGGREGATION RUNS HERE rather than in the browser: the board needs 30 element rates over
 * up to 500 pitches, and shipping every pitch's grades to the client to compute averages would
 * send a rep's entire scoring history down the wire to render six bars. It also keeps one
 * implementation of the averages, which is what makes the "sections sum to base" identity hold on
 * screen.
 */

/** The periods the boards offer: Day · Week · Month · All time. */
const PERIODS = ["day", "week", "month", "all"] as const;
type Period = (typeof PERIODS)[number];

/**
 * The window's start, from the SERVER's clock.
 *
 * A rep near midnight will disagree with this by a few hours, and that is a real limitation worth
 * stating rather than hiding: "today" here means the last 24 hours, not the rep's local calendar
 * day. The door log already solved local sales-days properly with a device timezone; this board
 * has no such input yet, so it uses a rolling window and says so rather than pretending to a
 * precision it does not have.
 */
export function periodStart(period: Period, now: Date): string | undefined {
  const ms = { day: 1, week: 7, month: 30 }[period as "day" | "week" | "month"];
  if (!ms) return undefined; // "all"
  return new Date(now.getTime() - ms * 24 * 60 * 60 * 1000).toISOString();
}

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "coach-pitch-breakdown", windowMs: 60_000, max: 60 });
  if (limited) return limited;

  const supabase = callerScopedDb(req) ?? (await createClient());
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const raw = req.nextUrl.searchParams.get("period") ?? "week";
  const period = (PERIODS as readonly string[]).includes(raw) ? (raw as Period) : "week";
  const repId = req.nextUrl.searchParams.get("repId") ?? undefined;

  const read = await readPitchPeriod(
    {
      // Default to the caller's OWN scores. Without this a rep opening their board would get the
      // whole company's average presented as theirs — RLS would allow it for a manager, and for a
      // rep it would silently become "everything I can see", which is not the same as "mine".
      repId: repId ?? auth.user.id,
      ...(periodStart(period, new Date()) ? { from: periodStart(period, new Date()) } : {}),
    },
    supabase
  );

  if (read === null) {
    // Never rendered as an empty period. "0 pitches this week" about a week the rep worked is the
    // confident-zero this codebase has an invariant against.
    return NextResponse.json({ error: "Could not load your scores." }, { status: 500 });
  }

  return NextResponse.json({
    period,
    aggregate: aggregatePitches(read.pitches),
    skippedPreVerdict: read.skippedPreVerdict,
  });
}
