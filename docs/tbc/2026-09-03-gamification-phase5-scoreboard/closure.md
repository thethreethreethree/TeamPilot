# CLOSURE — Gamification Phase 5 (scoreboard)

## What shipped
The team scoreboard — the visible payoff. A security-definer aggregate function (0243) returns per-agent
rank+totals+deals for the caller's company (never per-session detail, preserving A18); an auth-gated route serves
it; a clean competitive UI (nav item + page + component) renders it points-primary (D4) with band chips,
gold/silver/bronze ranks, deals, and the caller's row highlighted. Presentation restrained per the plan. Verified
against the live seed (Moses #1 3604, Johns #2 548), by route tests (4) + nav test (16) + typecheck, and by
RENDERING the board to a PNG and reading it (the founder specified a competitive interface — layer-2).

## Verification (A38)
db:apply 30/30; aggregate preview on live seed; 4 route tests; 16 nav tests; typecheck clean; a rendered-PNG visual
check. All in check.md.

## The un-named reliance
- Relies on the security-definer fn resolving auth.uid() to the CALLER (not the definer) so auth_company_id()
  scopes to the caller's company — standard Postgres definer semantics, and it returns only aggregates regardless.
- Relies on the SalesCoachShell layout wrapping the page (the page renders only the board content).

## Residual (A36 — explicit)
```json
[
  {
    "id": "GAM-R6",
    "item": "The agent's own points-TREND view (Phase 5 part 3) isn't built — only the leaderboard. The after-pitch review already shows a rep their per-session dimension detail, so the missing piece is just a points-over-time trend.",
    "why_skipped": "The founder asked for the scoreboard; the trend is additive and the detail view already exists.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-03T12:24:00+08:00",
    "outcome": "OPEN — add a points/band trend to the agent's own view as a follow-up."
  },
  {
    "id": "GAM-R7",
    "item": "The band chip on the board uses AVG points; a rep with a high total but low average shows a modest band next to a big number. That is intentional (band = per-session quality; total = accumulation) but could read oddly to some users.",
    "why_skipped": "Deliberate: the band describes typical session quality, the total describes accumulated ranking. A tooltip could clarify.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-03T12:24:00+08:00",
    "outcome": "OPEN — add a one-line tooltip on the band if it confuses users."
  }
]
```
