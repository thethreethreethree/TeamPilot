# CLOSURE — blocked-tile honesty state (Task 3, part 4)

## What shipped
The 2 uncomputable KPI tiles (Sales cycle length, Follow-up rate) no longer show "building…" — they honestly read
"needs prospect tracking". "building" promises the number is on its way; these two never are (they need prospect-
identity data the model doesn't capture). The KPI page now tells the truth on every tile.

## Verification (A38)
`npm run check` → EXIT 0 (see check.md). Typecheck covers the new field + branches; the rendered label is founder
visual-verify (pure presentation, no test harness for this client page).

## The un-named reliance
- **The render is not unit-tested** — this client page has no jsdom harness; the blocked-label swap is founder
  visual-verify. Typecheck guarantees the field and branches are wired.

## Residual (A36 — explicit)
```json
[
  {
    "id": "R1",
    "item": "Sales cycle length + Follow-up rate are now honestly BLOCKED, not built. Building them needs prospect-identity capture (link the same prospect across visits) — schema + a capture step + then the 2 metrics.",
    "why_skipped": "The founder chose the honesty relabel over the larger prospect-identity build; that build is the next pick if wanted.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-08-28T08:00:00+08:00",
    "outcome": "OPEN — prospect-identity capture unlocks both blocked tiles."
  },
  {
    "id": "R2",
    "item": "Objection + recommendation-uptake history backfill still open — both gate 'building' until sessions re-analyze; a forced LLM backfill would populate them now (founder cost decision).",
    "why_skipped": "Gating until re-analysis is correct §3.4 behavior; a bulk backfill is a cost decision.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-28T08:00:00+08:00",
    "outcome": "OPEN — offer a costed backfill if the founder wants the new metrics populated now."
  }
]
```
