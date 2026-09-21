import { NextRequest, NextResponse } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { readPatterns, readApplicableGrades, teamWidePatterns } from "@/lib/coach/patterns/readPatterns";

/**
 * GET /api/coach/sales-session/patterns?repId=<uuid>
 *
 * Pattern Interrupt's read. One route for both boards, because they are the same data with a
 * different scope — the rep board is the manager board limited to one rep, which is how the guide
 * describes it ("the same Patterns screen limited to the rep's own patterns").
 *
 * WHO SEES WHAT IS THE DATABASE'S ANSWER, NOT THIS ROUTE'S. `patterns` RLS is "your own row, or
 * any in your company if you manage", so this passes the caller's client and asks for what the
 * caller may have. A rep who hand-crafts `?repId=<someone else>` gets an empty list from the
 * policy rather than a 403 from a check this route remembered to write — the same reason the
 * leaderboard route was built this way, and one fewer place for the access rule to drift (§2.2).
 *
 * The default is the caller's OWN patterns. Without it, a rep opening their board would get
 * whatever RLS allows — which for a rep is themselves, but for a manager would be the entire
 * company presented as theirs.
 */
export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "coach-patterns", windowMs: 60_000, max: 60 });
  if (limited) return limited;

  const supabase = callerScopedDb(req) ?? (await createClient());
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const repId = req.nextUrl.searchParams.get("repId") ?? auth.user.id;

  // The grades the status resolver compares. Read once for the rep and shared across every one of
  // their patterns rather than re-read per item.
  const gradesByItem = await readApplicableGrades({ repId }, supabase);

  const read = await readPatterns({ repId, gradesByItem }, supabase);
  if (read === null) {
    // Never an empty board. "No patterns" about a rep whose patterns simply failed to load is the
    // confident-zero this codebase has an invariant against — and here it would read as praise.
    return NextResponse.json({ error: "Could not load patterns." }, { status: 500 });
  }

  return NextResponse.json({
    repId,
    patterns: read.patterns,
    /**
     * Both senses, computed once. C8: the chips and the rep-detail tile count Improving as open
     * (`open`), and the rep-progress list's third number excludes it (`openNotImproving`, which
     * the board labels "still open"). Returned as two named fields so no surface has to subtract
     * one from the other and get the ruling wrong.
     */
    counts: read.counts,
    /** 3+ reps on one item. Empty for a rep-scoped read, which is correct — it is team data. */
    teamWide: teamWidePatterns(read.patterns),
    /** The read's own verdict on whether it hit its bound, never re-derived from the array. */
    capped: read.capped,
    /**
     * Detection has not run for this rep yet, as distinct from "no patterns found".
     *
     * A rep with no scored pitches and a rep who is doing everything right both get an empty
     * list, and they are opposite facts. The board must not congratulate the first one.
     */
    scored: gradesByItem.size > 0,
  });
}
