# CLOSURE — After-Pitch "Your read" shows on every session

## What shipped
"Your read" now renders on every after-pitch that shows a summary, instead of hiding when the sales review
returned no signal. Real read when there's content; an honest short state when the call was too thin to review.

## Un-named reliance (not self-evident)
- **The ≥3-rep-turn floor still governs a REAL read.** `salesReview.ts` MIN_AGENT_SEGMENTS (=3) is unchanged, so
  a thin call shows the honest "too short" state rather than a made-up read. If the founder wants real reads on
  shorter calls, LOWER that constant — that's the tunable, deliberately not changed here (§3.4).
- **Not fabrication.** The empty state is honest by design; do not replace it with invented strengths.
- **Truly empty call (0 segments) still shows the top-level empty state** — the whole summary is EMPTY upstream,
  so there's no section to render. Realistic calls (any transcript signal) always show "Your read".

## Flagged, not fixed (§3.3)
- `MIN_AGENT_SEGMENTS = 3` in `salesReview.ts` — lower it (e.g. 2) if the founder wants real reads on shorter
  calls; trades review quality on thin transcripts. Founder decision.
- The transcript-collision item (#2) still means some sessions' reads were generated on multi-take transcripts —
  a separate data fix.

## Residual (A36)
```json
[
  { "id": "RES-01", "item": "No automated test of the always-render + empty-state branch.", "why_skipped": "Presentational conditional; verified by typecheck + live re-open. A unit test of the JSX branch is low value.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-04T00:33:37Z", "outcome": "OPENED — typecheck clean (exit 0); live-confirmed post-deploy." }
]
```
