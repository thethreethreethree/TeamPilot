import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { rateLimit } from "@/lib/api/rateLimit";
import { readPitchPeriod } from "@/lib/coach/pitchScore/readPitchPeriod";
import { derivePitchMilestones } from "@/lib/coach/pitchScore/milestones";

/**
 * GET /api/coach/sales-session/pitch-score/milestones?repId=…
 *
 * The rep dashboard's MILESTONES strip. Six badges and the date each was earned.
 *
 * NO PERIOD, and that is the whole difference from the breakdown route. Every milestone here is a
 * "first" or an "Nth" — First pitch, Century, the first time a pitch cleared 100 — so a window
 * would answer a different question and answer it confidently. "Your first pitch was Monday" is
 * true of this week and false about the rep.
 *
 * OLDEST FIRST, for the same reason one layer down. `readPitchPeriod` caps at 900 because
 * PostgREST tops out at 1000; on a newest-first read a rep past that cap would have "First pitch"
 * dated to their 900th-most-recent pitch. Reading ascending means the cap costs a rep their most
 * RECENT pitches, which no milestone depends on.
 *
 * CALLER-SCOPED, so RLS decides. 0252 grants select on `pitch_scores` to the rep themself or a
 * Sales Coach manager, which is exactly the rule this route wants — a rep reads their own strip, a
 * manager may read one of their team's. There is no service-role read here and no need for one.
 */

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "pitch-score-milestones", windowMs: 60_000, max: 60 });
  if (limited) return limited;

  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const supabase = callerScopedDb(req) ?? (await createClient());

  // Defaults to the caller's own strip. Without this, a manager's request with no repId would
  // derive milestones from the whole company's pitches and present them as one person's — a
  // "First pitch" date belonging to whoever joined earliest.
  const repId = req.nextUrl.searchParams.get("repId") ?? ctx.userId;

  const read = await readPitchPeriod({ repId, oldestFirst: true, limit: 900 }, supabase);

  if (read === null) {
    // Never an empty strip. Six unearned badges is a statement about the rep — "you have done
    // nothing" — and a failed read must not make it.
    return NextResponse.json({ error: "Could not load your milestones." }, { status: 500 });
  }

  return NextResponse.json({
    repId,
    milestones: derivePitchMilestones(read.pitches),
    /**
     * Whether the read hit its bound. The milestones are still correct when it did — they are all
     * earliest-first and the cap drops the most recent — but a caller that later adds a "latest"
     * badge needs to know, and a silent cap is the defect the leaderboard's own residual names.
     */
    capped: read.pitches.length >= 900,
  });
}
