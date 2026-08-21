# CLOSURE — Trend tile shows the balance ratio

## What shipped
The trend tile now shows the three direction-driving quality ratios (Actions owned / Stayed focused / Balanced),
so the surface matches the "improving/slipping" verdict it displays. Client-only; full `npm run check` exit 0
(3607 tests); no sales/server change.

## The un-named reliance
- Device confirmation for the tile render (renders null on failure).

## Residual (A36)

```json
[
  {
    "id": "decisions-stat-dropped",
    "item": "The tile no longer shows decisions/meeting (a non-directional count) to make room for the balanced ratio.",
    "why_skipped": "The tile is about the improvement DIRECTION; showing the three ratios that drive it is clearer than a count that does not. Decisions/meeting is still on each per-meeting review.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-22T03:17:00+08:00",
    "outcome": "Examined: the per-meeting review shows decisions; the trend tile is a direction summary, so the three direction ratios are the right three stats. Dropping the non-directional count from the summary is correct, not a loss."
  }
]
```
