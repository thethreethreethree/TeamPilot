# CHECK — Sales Coach: no minimum length, every session gets all content

## Audit (H1)
- A short-but-real session (≥1 rep turn) now generates the full content set: "Your read" (narrative),
  all five LLM score categories (on top of the two computed metrics), Dissect, moments, pivot, why, and
  the summary. The "This call was too short to read yet" note (`!narrative.hasSignal`) and the top-level
  "No conversation was captured" empty state (`!summary.hasSignal`) no longer fire on a real short pitch,
  because every engine returns `hasSignal:true` + content.
- Honesty preserved (§3.4): the prompts still forbid fabricated quotes/statistics and require every point
  to be grounded in a real transcript line. A brief call yields a brief, REAL read — not an invented one.
- Only genuinely-empty inputs still short-circuit: 0 agent turns (a one-sided capture gap — matches the
  existing talk-ratio `custW===0` caveat) and a 0-segment transcript. These are honest data-gap states,
  not "minimum time" gates.

## Class sweep (A26)
Swept every v5 content engine for a length/too-thin gate (`grep -nE "MIN_(AGENT_)?SEGMENTS|< *MIN|
segments.*length *< *[0-9]"` + a read of each prompt's honesty block):
- **Fixed (both layers):** salesReview, salesScore, salesMoments, salesDissect, salesPivot, salesWhy.
- **Fixed (engine floor only; no prompt refusal):** salesIntel.
- **Already clean:** salesSummary (only a 0-segment guard — never a length floor).
- **Deliberately out of scope (different domain, not the after-pitch per-session content):** liveCue /
  liveConfidence (real-time in-call cue, needs ≥2 segments to compare deltas), salesWhyPatterns
  (cross-session aggregate, `MIN_WHYS`), pitchSeparation (audio DSP), debrief (chat-coach, not sales),
  skillAnalytics / useLiveCoaching (live analytics). Recorded so the boundary is on the record, not silent.

## Findings
no findings — the change is bounded to the per-session content engines; honesty rules intact; the page
needed no edit (its gates are satisfied once the engines return content); the one test asserting the old
floor was updated to the new contract.

## Verification (A38)
```
$ npx tsc --noEmit
tsc exit: 0

$ npx vitest run src/lib/coach/v5/__tests__/
 Test Files  48 passed (48)
      Tests  397 passed (397)         vitest exit: 0

$ npm run build:ci
✅ Secretless build PASSED — CI's Build step will pass with this change.
build exit: 0
```
All three gates pass (exit 0). The live After-Pitch screen is owner-private (RLS) and needs real call
data, so it can't be headlessly screenshotted; the behavior is proven at the engine/prompt layer + the
updated test that asserts a short call now generates a read. Full `npm run check` is the CI gate on push.
