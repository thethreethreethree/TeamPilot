# CHECK — the rubric has three consumers and no door

## Findings

### F1 — a fourth consumer exists and the rubric has no door
class: unreachable-authority (a single source of truth that one of its consumers cannot reach)
sweep: `grep -rln "SECTIONS\|rubric" src/app/api/coach --include=route.ts`, then read each hit to see whether it RETURNS the rubric or merely mentions it
severity: medium

All seven pitch-score routes were opened. None returns the rubric; the breakdown route's only match
is a docblock line. `ScoringRubricSheet.tsx` imports `SECTIONS, BONUSES, VIOLATIONS` directly.
The mobile app cannot import from this repository, so two boards were unbuildable.

### F2 — the obvious client-side substitute is wrong in a way that hides
class: silently-truncated-denominator
sweep: read `aggregatePitches`' element loop and ask what happens to an element no counted pitch graded
severity: medium

`if (gradedIn === 0) continue;` omits ungraded elements from `elementStats`. Summing their
`maxPoints` to get a section max understates it, inflating the percentage and potentially moving the
LOWEST badge. Correct for any rep who reached every element, wrong for a new one.

### F3 — the build plan asserted this data was already deployed
class: stale-claim-in-a-governing-document
sweep: check each row of `MOBILE-BUILD-PLAN.md` §6 against the routes on disk
severity: low

§6 is headed "Data — nothing new to build" and lists "Rubric for the sheet — `rubric_config` via the
score route". No route serves it, and nothing in `src/` reads `rubric_config` at all — the table is
named in migration 0252 and in the guide, and `rubric.ts`'s comment quotes the requirement as an
aspiration. Corrected in the mobile plan rather than left to be discovered mid-build.

### F4 - the route served PART of the rubric, which is the same mistake one step smaller
class: incomplete-authority (a single source served partially, so the consumer fills the gap by hand)
sweep: list every export of `rubric.ts` and check each appears in the response
severity: medium

Found while building the sheet that consumes it. The first version returned version, maxima,
grade credit, sections, elements, bonuses and violations - and omitted `QUALIFYING_MIN_BASE`,
`PRIZE_ELIGIBLE_MIN_PITCHES` and `NEVER_GRADE_FOR_ACCURACY`.

The sheet prints five competition rules and three of them carry those numbers. So the route built
to stop a client hard-coding the rubric would have forced that client to hard-code 40 and 5.

Not caught by any earlier test, because every one of them asserted that what IS returned is
correct. None asked whether anything was missing - which is the shape of the whole finding.

## What I did NOT do

`rubric_config` is still not read by anything. This route serves `rubric.ts`, which is the actual
source of truth today. Making the table the source is a larger change with a migration and a
versioning story, and it is not needed to unblock the phone.

## Verification

  $ npx vitest run src/app/api/coach/sales-session/pitch-score/rubric
  Tests  8 passed (8)

  $ npx tsc --noEmit
  exit 0

  $ npm run check
  (recorded in closure)
