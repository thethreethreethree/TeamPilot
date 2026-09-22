import { NextRequest, NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { rateLimit } from "@/lib/api/rateLimit";
import {
  BASE_MAX,
  BONUS_CAP,
  BONUSES,
  ELEMENTS,
  GRADE_CREDIT,
  MAX_SCORE,
  NEVER_GRADE_FOR_ACCURACY,
  PRIZE_ELIGIBLE_MIN_PITCHES,
  QUALIFYING_MIN_BASE,
  RUBRIC_VERSION,
  SECTIONS,
  VIOLATIONS,
} from "@/lib/coach/pitchScore/rubric";

/**
 * GET /api/coach/sales-session/pitch-score/rubric — the rubric itself, for clients that cannot import it.
 *
 * WHY THIS EXISTS. `rubric.ts` is the single source of truth and its own docblock explains why it is
 * data rather than logic: three consumers read it, and *"if the rubric lived in the scorer, the
 * other two would each grow their own copy and drift"*. On the web all three consumers `import` it,
 * so no route was ever needed.
 *
 * The mobile app is a fourth consumer and it cannot import anything from this repository. Without
 * this route it has exactly two options, and both are the failure the file was written to prevent:
 * transcribe thirty elements into the phone, or do without.
 *
 * TWO THINGS ON THE REP DASHBOARD NEED IT, not just the rubric sheet:
 *
 *   1. The Breakdown board prints each section as "9.8 / 12". The 12 is `SECTIONS[].maxPoints`.
 *   2. The LOWEST badge is by PERCENTAGE of section max, not absolute points — team Transitions 4.7
 *      is lower in points than Close 8.6, and Close carries the badge because 57.3% < 58.8%. That
 *      rule is unimplementable without the maxima.
 *
 * AND THE MAXIMA CANNOT BE DERIVED FROM THE AGGREGATE, which is the trap worth recording. The
 * obvious move is to sum `maxPoints` across `elementStats` for a section. `aggregatePitches` drops
 * any element with `gradedIn === 0`, so a section containing an element the rep never reached would
 * report a smaller max, a higher percentage, and could hand the LOWEST badge to the wrong section.
 * It would look right on any rep who had reached everything.
 *
 * READ-ONLY AND NOT PER-REP. There is no user data here, no database read, and no `repId`. It is the
 * same constant for everyone in the product. Authentication is still required — this is the
 * company's scoring methodology, not public documentation — but there is nothing for RLS to scope,
 * so no Supabase client is created.
 *
 * VERSIONED, AND THE VERSION TRAVELS WITH IT. `pitches.rubric_version` pins the config a score was
 * computed under, and `rubric.ts` may not be edited in place once scores reference it. A client that
 * renders this must show scores against the version it was given rather than assume today's rubric
 * explains an old pitch — which is exactly what the guide means by "rendered from `rubric_config`
 * so it never goes stale".
 *
 * CACHEABLE IN PRINCIPLE, unlike every other route in this folder: the body changes only when the
 * rubric version changes. The header says so for any browser or CDN in front of it.
 *
 * IT DOES NOT SAVE THE MOBILE APP ANYTHING, and the first draft of this comment claimed it did.
 * `coachGet` calls the global fetch with no cache option and React Native implements no HTTP
 * response cache, so the phone refetches every time regardless of this header. Caching there means
 * holding the body keyed by `version` — stronger than any duration, because the rubric is immutable
 * per version. Left unbuilt: no client calls this route yet, and optimising an unmeasured request is
 * exactly the confident work the build register exists to catch.
 */

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "pitch-score-rubric", windowMs: 60_000, max: 60 });
  if (limited) return limited;

  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  return NextResponse.json(
    {
      version: RUBRIC_VERSION,
      /** The three structural numbers the boards print: "100 + 30 − Viol. = 130 Max score". */
      baseMax: BASE_MAX,
      bonusCap: BONUS_CAP,
      maxScore: MAX_SCORE,
      /** Hit / Partial / Missed credit. Partial is explicitly "half points" in the rubric. */
      gradeCredit: GRADE_CREDIT,
      /*
        THE COMPETITION THRESHOLDS, ADDED AFTER THE FIRST VERSION SHIPPED WITHOUT THEM.

        The rubric sheet prints five competition rules, three of which carry numbers: a pitch
        counts only above 40 base, five counted pitches make a rep prize-eligible, and a pitch
        never scores below 0. They live in `rubric.ts` beside everything else here, and omitting
        them would have forced the one client this route exists for to hard-code exactly the
        numbers the guide forbids hard-coding.

        Serving PART of the rubric is the same mistake as serving none of it, one step smaller.
      */
      qualifyingMinBase: QUALIFYING_MIN_BASE,
      prizeEligibleMinPitches: PRIZE_ELIGIBLE_MIN_PITCHES,
      /** What the AI may never grade for accuracy — the answer a rep gets when disputing a score. */
      neverGradeForAccuracy: NEVER_GRADE_FOR_ACCURACY,
      sections: SECTIONS,
      elements: ELEMENTS,
      bonuses: BONUSES,
      violations: VIOLATIONS,
    },
    {
      headers: {
        // Immutable per version, so a browser or CDN may hold it. NOTE: this does NOT save the mobile
        // app a request — React Native's fetch implements no HTTP response cache, so the phone refetches
        // regardless. Caching there means holding the body keyed by `version`, which is stronger than
        // any duration because the rubric is immutable per version. Recorded in the build's R3.
        "Cache-Control": "private, max-age=3600",
      },
    },
  );
}
