# CLOSURE — Follow-up + Sales cycle on the manager roster (Task 3, part 7)

## What shipped
The manager team roster now shows all four new metrics per rep: Objections, Uptake, Follow-up rate, and Sales
cycle — full parity. Follow-up + Sales cycle are computed from the same session read (client_label added to the
existing select), same functions + gates as the rep's own /me view. Roster columns + CSV both updated.

## Privacy held (A18)
Only aggregate MetricResults were added — never raw session data. The A18 allow-list test flagged the 2 new keys
and forced a conscious update; its raw-leak assertions still pass.

## Verification (A38)
`npm run check` → EXIT 0 (see check.md). Team route + A18 tests pass (10/10); typecheck covers the flow. The
roster columns rendering over live data are founder visual-verify.

## The un-named reliance
- **The roster render is founder visual-verify** — no jsdom harness for this client page. The per-agent
  computation + privacy contract are unit-gated.
- **Sales cycle reads "building" for reps with <5 sold prospects** (same honest gate as /me); Follow-up rate is
  live for active reps.

## Residual (A36 — explicit)
```json
[
  {
    "id": "R1",
    "item": "Objection history backfill still open — objections fills as sessions re-analyze; a forced LLM backfill would populate it now (founder cost decision).",
    "why_skipped": "Gating until re-analysis is correct §3.4 behavior; a bulk backfill is a cost decision.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-28T11:15:00+08:00",
    "outcome": "OPEN — offer a costed backfill if the founder wants objection numbers populated now."
  },
  {
    "id": "R2",
    "item": "Next founder feature (mid-session request): a 'Role Play' button on the Pitch Performance page that replays the rep's EXACT recorded pitch as a practice scenario. Not started — to be scoped after this build.",
    "why_skipped": "Founder said to take it up after the current build completes.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-08-28T11:15:00+08:00",
    "outcome": "OPEN — scope the role-play-from-recorded-pitch feature next."
  }
]
```
