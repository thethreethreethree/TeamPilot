# BUILD — door pitches feed the Coach Assessment

### Merge aggregator (§1.5.1 / §3.4)
- write-path: `coachAssessmentAggregate.ts` — `aggregateCoachingContent(dissectRows, pitchRows)` normalizes dissect
  `{point}`/`{opportunity}` AND pitch plain-string `strengths`/`improvements` into one newest-first Doing Well / Focus.
- read-path: a rep's card draws coaching content from their pitches AND sessions, whichever is recent.

### Route reads pitch_analyses (§3.4 honest-degrade)
- write-path: `coach-assessment/route.ts` — per rep, two new admin queries on `pitch_analyses` (rep_id + company_id):
  EXACT head count + recent-N content. `aggregateCoachingContent` replaces `aggregateDissectContent`; returns
  `pitchCount`. The two new queries join the `if (…error) return degraded` guard.
- read-path: the manager payload now carries each rep's door-pitch coaching content + pitch count.

### Page surfaces it
- write-path: `coach-assessment/page.tsx` — `withContent`/`noContent` gate on `dissectCount > 0 || pitchCount > 0`;
  the badge reads "N sessions dissected · M pitches analyzed".
- read-path: a pure-pitcher rep is no longer listed under "no sessions yet"; their real coaching signal shows.

## Files
- `src/lib/coach/v5/coachAssessmentAggregate.ts` (+ test) — the merge
- `src/app/api/coach/sales-session/coach-assessment/route.ts` — reads pitch_analyses, merges, pitchCount
- `src/app/dashboard/sales-coach/coach-assessment/page.tsx` — content gate + badge
- `src/lib/coach/v5/generateAndStoreAfterPitch.ts` — reverted a wrong first attempt (after-pitch ≠ door pitch)

## Ripple (§6 item 5)
`aggregateDissectContent` stays (my-training, the rep's OWN view, is untouched — a follow-up could give it the same
merge). No schema/migration change — `pitch_analyses` already exists (0215) with rep_id/company_id/strengths/
improvements/created_at; admin (service role) reads it past RLS, consistent with the existing dissect-event read. The
count semantics changed additively (a new `pitchCount`), not the existing `dissectCount`.

## Honest limit
The route's per-rep merge over live data isn't unit-tested end-to-end (the route test uses an empty roster); the
MERGE logic is unit-gated, and the population was verified against live data (Moses 36 pitches surface). A rep with
zero pitches AND zero sessions stays blank — correct, they have no assessed work yet.
