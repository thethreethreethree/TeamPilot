# CLOSURE — Meeting Dissect improvement-trend aggregate

## What shipped
The §3.6 make-learning-visible piece: `aggregateMeetingDissects` (pure, tested) + a company-pinned
`GET /trend` route. Reports the team's meeting-improvement TREND (recent-vs-earlier on owned-action + focused
ratios), honestly "insufficient" below the minimum (no faked curve). With this the Phase-6 Dissect is complete:
measurement -> store -> route -> UI -> trend. Full `npm run check` exit 0 (3598 tests); no sales/server change.

## The un-named reliance
- **The founder's §3.5/direction sign-off.** The measured consequences AND the direction heuristic are a
  PROPOSED default flagged for adjustment (built, not offloaded).
- **A trend UI/dashboard tile.** The route returns the trend; a visible tile is a small follow-up (ties to where
  Team-Sync/meeting-coach surfaces live — founder-gated nav).

## Open
1. A trend UI tile (render the direction + the recent/earlier metrics).
2. Wire the review link + trend into a meetings surface (nav placement — founder-gated).
3. Founder sign-off on the §3.5 consequence set + the direction heuristic.

## Residual (A36 — ranked by confidence it doesn't matter; the top is examined)

```json
[
  {
    "id": "direction-heuristic-weighting",
    "item": "The trend direction uses owned-action + focused ratios (not decisions/meeting or open-items) and a fixed TOLERANCE.",
    "why_skipped": "'More decisions' isn't unambiguously better (a decisive 5-min huddle vs a 40-min one), and 'more owners on actions' + 'more focused' ARE unambiguously better meeting quality — so the direction reads the two monotonic-good signals only; the raw counts are reported but not directional.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-22T01:22:00+08:00",
    "outcome": "Examined which signals are monotonic-good: owned-ratio and focused-ratio increase = unambiguously better; decision/open-item COUNTS are context-dependent. Reading direction from only the monotonic signals is the honest choice; the counts stay visible for the human. Heuristic + TOLERANCE are PROPOSED for founder adjustment, isolated in one pure function + tests."
  }
]
```
