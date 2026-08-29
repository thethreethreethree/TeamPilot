# CLOSURE — roster-ordering completeness

## What shipped
A §1.7 ground-up sweep of every people/member roster surface found three still sorting alphabetically or by
created_at — the surfaces the stage-1 pass missed. All three now order top-to-bottom by the org hierarchy
(`byOrgRank`): the Sales-Coach and C.A.R.E Coach-Assessment rosters, and `GET /api/team` (which also settles the
file-access and finance-cover pickers that read it). A founder-approved membership fix widens the C.A.R.E coach
filter to include CFO. Three order-regression guards lock the ordering so a silent sort-drop fails a test. This
completes the team-reorg directive "applies for ALL the system" by measurement, not assumption.

## Verification (A38)
`npm run check` → EXIT 0 (pasted in check.md). The sort SOURCE (`byOrgRank`) is unit-tested; three representative
guards assert the actual output order across both the data layer and a route.

## The un-named reliance
- **The three rendered surfaces are founder visual-verify** — no jsdom harness for the pages. The security-neutral
  sort logic is unit-gated + typechecked. The CFO newly appearing on the C.A.R.E coach roster is a live-data check.
- **§A18 compatibility rests on "org rank is not a performance grade"** — true by construction (rank is org-chart
  position), so the not-a-leaderboard property is preserved while the founder's ordering is applied.

## Residual (A36 — explicit)
```json
[
  {
    "id": "R4",
    "item": "The Sales-Coach coach-assessment route and GET /api/team GET-order are covered by the shared byOrgRank primitive + their sibling guards, but do not each have a bespoke order-regression harness (the coach-assessment harness returns an empty roster by design; a /api/team GET harness would be new). Proportionate: three representative guards across both layers exercise the identical one-line call.",
    "why_skipped": "Two more bespoke harnesses for the same unit-tested primitive is noise, not coverage (the don't-manufacture discipline).",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-29T10:35:00+08:00",
    "outcome": "OPENED + verified. Both un-guarded surfaces genuinely call the sort — api/team/route.ts:60 and coach-assessment/route.ts:216 — and byOrgRank is unit-tested in roles.test (3 refs) with its edge cases (null/unknown role, name tiebreak, scrambled tiers) locked by the fetchTeam guard. The reliance is real, not a phantom, so the two bespoke harnesses stay proportionately unbuilt. No change needed."
  }
]
```
