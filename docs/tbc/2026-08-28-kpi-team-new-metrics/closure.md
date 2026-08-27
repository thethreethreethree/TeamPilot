# CLOSURE — new metrics on the manager roster (Task 3, part 5)

## What shipped
Objections per session + Recommendation uptake now appear per-rep on the MANAGER team roster (columns + CSV),
computed from the after-pitch payloads the team route already fetched — no new query. Same functions + gates as
the rep's own /me view, so a rep's number matches between their view and the manager's rollup.

## Privacy held (A18)
Only aggregate MetricResults were added — never a rep's raw per-session scores. The A18 allow-list test flagged
the new keys and forced a conscious update; its raw-score-leak assertions still pass.

## Verification (A38)
`npm run check` → EXIT 0 (see check.md). Team route + A18 privacy tests pass (10/10); typecheck covers the flow.
The roster columns rendering over live data are founder visual-verify.

## The un-named reliance
- **The roster render is founder visual-verify** — this client page has no jsdom harness. The per-agent
  computation + the privacy contract are unit-gated.
- **Objections reads "building" on the roster until re-analysis** (same as /me — the tally is new); Uptake
  populates now for reps with enough flagged-then-rescored pairs.

## Residual (A36 — explicit)
```json
[
  {
    "id": "R1",
    "item": "Objection + recommendation-uptake history backfill still open — both fill as sessions re-analyze; a forced LLM backfill would populate objections now (founder cost decision).",
    "why_skipped": "Gating until re-analysis is correct §3.4 behavior; a bulk backfill is a cost decision.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-28T08:25:00+08:00",
    "outcome": "OPEN — offer a costed backfill if the founder wants objection numbers populated now."
  },
  {
    "id": "R2",
    "item": "Sales cycle length + Follow-up rate remain honestly blocked ('needs prospect tracking'); building them needs prospect-identity capture.",
    "why_skipped": "Blocked on new capture; the founder chose the honesty relabel over the larger build.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-08-28T08:25:00+08:00",
    "outcome": "OPEN — prospect-identity capture unlocks both."
  }
]
```
