# CLOSURE — Follow-up rate + Sales cycle from client_label (Task 3, part 6)

## What shipped
The last 2 "blocked" KPI tiles are now REAL metrics — no new capture. Follow-up rate (distinct prospects
re-contacted ÷ total) and Sales cycle length (avg first→sold days) are derived from the `client_label` reps
already enter (96% populated, reused), normalized. The KPI page now has a real value or an honest "building" on
every Layer-1/2/3/4 tile — nothing blocked, nothing lying.

## The correction that saved the build (§0/§3.3)
The founder picked "build prospect-identity capture" assuming new capture was needed. Probing the data first
showed client_label already IS the prospect identity (reused across sessions). I corrected the founder; they chose
to derive from it — turning a large schema+capture+adoption build into a pure, no-new-read computation.

## Verification (A38)
`npm run check` → EXIT 0 (see check.md). Normalizer + both metrics + both gates unit-gated (+5 cases). Live:
follow-up 25-36% for active reps; sales cycle 0.1d for Moses, honestly gated elsewhere.

## The un-named reliance
- **client_label is a free-text PROXY** — variant spellings undercount re-contact, duplicate names overcount. Real
  and useful, but not an exact prospect id. A dedicated prospect entity is the precise path IF the fuzziness ever
  matters (deferred — not needed at current data quality).
- **Sales cycle is thin** — most reps have <5 session-sold prospects (session sells skew same-visit), so it reads
  "building" for them. Correct §3.4 behavior; it fills as multi-visit closes accrue.
- **The tile render is founder visual-verify** — this client page has no jsdom harness; compute + gates are gated.

## Residual (A36 — explicit)
```json
[
  {
    "id": "R1",
    "item": "Follow-up rate + Sales cycle are on the /me self-view only, not the manager team roster (unlike objections/uptake which were surfaced there).",
    "why_skipped": "The founder's pick was to build the metrics from client_label; surfacing to the roster is a separate optional scope.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-28T10:40:00+08:00",
    "outcome": "OPEN — surface both to the manager roster too if the founder wants parity with objections/uptake."
  },
  {
    "id": "R2",
    "item": "Objection history backfill still open — objections fills as sessions re-analyze; a forced LLM backfill would populate it now (founder cost decision).",
    "why_skipped": "Gating until re-analysis is correct §3.4 behavior; a bulk backfill is a cost decision.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-28T10:40:00+08:00",
    "outcome": "OPEN — offer a costed backfill if the founder wants objection numbers populated now."
  }
]
```
