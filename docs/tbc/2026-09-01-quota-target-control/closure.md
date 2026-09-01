# CLOSURE — wire the missing quota-target control

## What shipped
The Quota KPI could never activate through the product: the manager-gated `PATCH /quota` endpoint existed but
**no UI called it** (grep: 0 `.tsx` callers). A manager-only inline editor now lives in the KPI Team section —
unset shows a **Set target** prompt, set shows the value with **Edit**, and saving PATCHes the existing route then
refreshes both the headline Quota (`/me`) and the per-rep Quota columns (`/team`) so nothing lags on "building".
Client validation mirrors the server bound term-for-term; clearing the field honestly returns Quota to "building".

## Verification (A38)
`npm run typecheck` exit 0, `eslint` on the page exit 0 (pasted in check.md). The mutation route keeps its
pre-existing test; the client control is founder-visual-verify (no render harness on this page).

## The un-named reliance
- Relies on the Team section's manager gate (`team !== null`, i.e. `/team` returned 200) matching the PATCH
  route's `isSalesCoachManager` gate. If they ever diverge, the route's own 403 is caught and shown inline — the
  control degrades to a visible error, never a crash or a silent no-op.
- Relies on `/me` and `/team` both recomputing Quota against the freshly-saved target on their next fetch (they
  read `companies.sales_coach_monthly_deal_target`, which the PATCH just wrote).

## Residual (A36 — explicit)
```json
[
  {
    "id": "KPI-R10",
    "item": "Client-side quota bound (int 1..100000) is a hand-mirror of the route's Zod schema. If the schema's max/min changes, the client copy can drift.",
    "why_skipped": "Low-risk: on drift the server still rejects an out-of-bound value (the client just shows a stale hint), so it degrades safe. A shared constant would remove the drift entirely.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-01T09:20:00+08:00",
    "outcome": "OPEN — extract the bound to a shared constant imported by both the route schema and the client if this validation grows."
  }
]
```
