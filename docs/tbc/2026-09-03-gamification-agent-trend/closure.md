# CLOSURE — Gamification: agent points-trend view (Phase 5 part 3)

## What shipped
The rep's own progress on the scoreboard: a summary (total / avg / sessions), a restrained points-per-session
sparkline, and their recent sessions each linking to the (private) after-pitch breakdown. Reads the caller's own
ledger via owner-RLS — private data, distinct from the public board. This closes the agent-facing side of Phase 5;
the after-pitch remains the per-session detail view (D13/D15). 3 route tests + typecheck + a rendered visual check.

## Verification (A38)
`npx vitest run .../my-points/` → 3/3; `npm run typecheck` clean; a rendered-PNG visual check. In check.md.

## The un-named reliance
- Relies on owner-RLS on agent_point_ledger so the caller reads only their own rows.
- Relies on the after-pitch route existing at /dashboard/sales-coach/<id>/after-pitch for the session links.

## Residual (A36)
```json
[
  {
    "id": "GAM-R10",
    "item": "The sparkline plots points-per-session, not per-DIMENSION averages (the plan's part-3 wording). Points already summarize the dimensions, so a single points trend is the honest at-a-glance signal; per-dimension trends would be a richer follow-up.",
    "why_skipped": "Points reuse the dimensions; a single trend is clearer for a rep than five overlaid lines.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-03T12:41:00+08:00",
    "outcome": "OPEN — add per-dimension trends if a rep wants to see which specific skill is moving."
  }
]
```
