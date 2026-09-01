# CLOSURE — company-aggregate KPI scope

## What shipped
An owner/admin now sees the WHOLE-BUSINESS aggregate on the KPI cards (default), with a Company/Mine toggle. The
per-rep view stayed "building" because outcomes are sparse per rep; pooled across the company the objective Layer-1
numbers cross the gate and SHOW — confirmed against live data (top company: Conversion 40.9%, Close 69%, Win/loss
2.25). Reuses the exact compute over a company-scoped row set (no new engine, no gate change); company-scope is
admin-gated with a self fallback so no business leaks. This is the "per-business KPI, each company separated" the
founder has asked for repeatedly.

## Verification (A38)
`npm run check` on the commit run. Live-DB gate-check pasted in check.md. Typecheck clean. The scope branch + page
toggle are founder-visual-verify (no route/page render harness); the compute is the already-tested compute.ts.

## The un-named reliance
- Relies on the EXISTING coaching_sessions RLS same-company read policy (the team route already depends on it) so
  an admin's `.in("agent_id", memberIds)` returns the company's rows. Not changed here.

## Residual (A36 — explicit)
```json
[
  {
    "id": "KPI-R5",
    "item": "Revenue + Avg-deal-size + Quota still read 'building' even company-wide: ZERO sold sessions carry a deal value, and the company monthly target may be unset. These fill as reps enter deal values (the outcome prompt now captures it on a 'sold') and once the company sets sales_coach_monthly_deal_target.",
    "why_skipped": "Honest data gap (§3.4), not a bug — the fix cannot fabricate a revenue number that no one entered.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-08-29T11:40:00+08:00",
    "outcome": "OPEN — watch deal-value capture climb; prompt the founder to set the monthly target for Quota."
  },
  {
    "id": "KPI-R6",
    "item": "In company scope the deltas ('vs earlier') and the page subtitle still read as the individual's trajectory; they now reflect the company's recent-vs-prior. The toggle labels the view, but the copy could be scope-aware.",
    "why_skipped": "Cosmetic; the numbers are correct and the toggle names the scope. Layer-4 polish.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-29T11:40:00+08:00",
    "outcome": "OPEN — make the subtitle/delta copy scope-aware in a follow-up."
  }
]
```
