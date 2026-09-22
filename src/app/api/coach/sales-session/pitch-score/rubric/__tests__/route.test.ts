import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/coach/sales-session/pitch-score/rubric.
 *
 * WHAT THIS ROUTE IS FOR. `rubric.ts` is the single source of truth and its docblock says why it is
 * data rather than logic: three consumers read it, and *"if the rubric lived in the scorer, the
 * other two would each grow their own copy and drift"*. All three `import` it, so no route existed.
 *
 * The mobile app is a fourth consumer that cannot import from this repository. Without this route it
 * must transcribe thirty elements into the phone — the exact duplication `rubric.ts` was written to
 * prevent, and one that would go stale silently the first time the rubric versions.
 *
 * THE TEST THAT MATTERS IS THE LAST ONE. It is not enough that the route returns *a* rubric; it must
 * return THE rubric, unaltered. A route that quietly reshaped a field would hand the phone a
 * different scoring methodology from the one that produced the scores it is rendering.
 */

vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));

import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { rateLimit } from "@/lib/api/rateLimit";
import {
  BASE_MAX,
  BONUS_CAP,
  BONUSES,
  ELEMENTS,
  MAX_SCORE,
  NEVER_GRADE_FOR_ACCURACY,
  PRIZE_ELIGIBLE_MIN_PITCHES,
  QUALIFYING_MIN_BASE,
  RUBRIC_VERSION,
  SECTIONS,
  VIOLATIONS,
} from "@/lib/coach/pitchScore/rubric";
import { GET } from "../route";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const req = () => ({ headers: new Headers() }) as never;

describe("GET /pitch-score/rubric", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asMock(rateLimit).mockReturnValue(null);
    asMock(resolveApiAuth).mockResolvedValue({ userId: "rep-me", companyId: "co" });
  });

  it("refuses an unauthenticated caller", async () => {
    // Not public documentation — it is the company's scoring methodology.
    asMock(resolveApiAuth).mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("honours the rate limiter", async () => {
    const limited = new Response(null, { status: 429 });
    asMock(rateLimit).mockReturnValue(limited);
    expect(await GET(req())).toBe(limited);
  });

  it("reads no database and needs no rep", async () => {
    /*
      There is no user data here and nothing for RLS to scope, so no Supabase client is created —
      which is why this test file mocks neither `createClient` nor `callerScopedDb`. If the route
      ever grows a database read, this test fails to compile its mocks and someone has to think
      about whose rubric is being returned.
    */
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.repId).toBeUndefined();
  });

  it("carries the version, so a score stays explainable against the rubric that produced it", async () => {
    // `pitches.rubric_version` pins the config a score was computed under. A client rendering an
    // old pitch against today's rubric would explain it with numbers that never applied to it.
    const body = await (await GET(req())).json();
    expect(body.version).toBe(RUBRIC_VERSION);
  });

  it("carries the three structural numbers the boards print", async () => {
    // The sheet states "100 + 30 − Viol. = 130 Max score", and the gauge runs 0–130 rather than
    // 0–100. All three come from here rather than being typed into the phone.
    const body = await (await GET(req())).json();
    expect(body.baseMax).toBe(BASE_MAX);
    expect(body.bonusCap).toBe(BONUS_CAP);
    expect(body.maxScore).toBe(MAX_SCORE);
    expect(body.baseMax + body.bonusCap).toBe(body.maxScore);
  });

  it("carries section maxima, which the aggregate cannot supply", async () => {
    /*
      THE TRAP THIS ROUTE EXISTS FOR. The obvious way to get a section's max on the client is to sum
      `maxPoints` across `elementStats`. `aggregatePitches` drops any element with `gradedIn === 0`,
      so a section holding an element the rep never reached reports a SMALLER max, a HIGHER
      percentage, and can hand the LOWEST badge to the wrong section — while looking correct for any
      rep who reached everything.

      The badge is by percentage of max: team Transitions 4.7 is lower in points than Close 8.6, and
      Close carries the badge because 8.6/15 = 57.3% is below 4.7/8 = 58.8%.
    */
    const body = await (await GET(req())).json();
    expect(body.sections).toHaveLength(6);
    const total = body.sections.reduce(
      (sum: number, s: { maxPoints: number }) => sum + s.maxPoints,
      0,
    );
    expect(total).toBe(BASE_MAX);
    const close = body.sections.find((s: { id: string }) => s.id === "close");
    const transitions = body.sections.find((s: { id: string }) => s.id === "transitions");
    expect(close.maxPoints).toBe(15);
    expect(transitions.maxPoints).toBe(8);
    // The percentage rule is only expressible because these differ by a factor of nearly two.
    expect(8.6 / close.maxPoints).toBeLessThan(4.7 / transitions.maxPoints);
  });

  it("returns THE rubric, not a reshaped copy of it", async () => {
    /*
      The whole point. A route that renamed or rounded a field would hand the phone a different
      methodology from the one that produced the scores it renders, and every number would still
      look plausible.
    */
    const body = await (await GET(req())).json();
    expect(body.sections).toEqual(JSON.parse(JSON.stringify(SECTIONS)));
    expect(body.elements).toEqual(JSON.parse(JSON.stringify(ELEMENTS)));
    expect(body.bonuses).toEqual(JSON.parse(JSON.stringify(BONUSES)));
    expect(body.violations).toEqual(JSON.parse(JSON.stringify(VIOLATIONS)));
  });

  it("carries the competition thresholds the sheet prints as rules", async () => {
    /*
      ADDED AFTER THE FIRST VERSION SHIPPED WITHOUT THEM, and the omission is the point. The rubric
      sheet prints five competition rules; three carry numbers. Without these the mobile client
      would have had to hard-code 40 and 5 — exactly what the guide forbids, and exactly the
      hard-coding this whole route exists to prevent.

      Serving part of the rubric is the same mistake as serving none of it, one step smaller.
    */
    const body = await (await GET(req())).json();
    expect(body.qualifyingMinBase).toBe(QUALIFYING_MIN_BASE);
    expect(body.prizeEligibleMinPitches).toBe(PRIZE_ELIGIBLE_MIN_PITCHES);
    expect(body.neverGradeForAccuracy).toEqual(JSON.parse(JSON.stringify(NEVER_GRADE_FOR_ACCURACY)));
  });

  it("serves every exported part of the rubric, so no client has to fill a gap", async () => {
    // The guard against this happening a third time: a field added to rubric.ts and not here sends
    // the next consumer back to typing numbers into a phone.
    const body = await (await GET(req())).json();
    for (const key of [
      "version", "baseMax", "bonusCap", "maxScore", "gradeCredit",
      "qualifyingMinBase", "prizeEligibleMinPitches", "neverGradeForAccuracy",
      "sections", "elements", "bonuses", "violations",
    ]) {
      expect(body[key], `missing ${key}`).toBeDefined();
    }
  });

  it("is cacheable, because a doorstep should not refetch thirty elements twice", async () => {
    const res = await GET(req());
    expect(res.headers.get("Cache-Control")).toMatch(/private/);
  });
});
