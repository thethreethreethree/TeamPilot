# BUILD — roster-ordering completeness

### Fix 1: Sales-Coach Coach-Assessment roster orders by org hierarchy
- write-path: `coach-assessment/route.ts` — profiles select adds `role`; a `roleById` map feeds
  `.sort(byOrgRank((t) => roleById.get(t.agentId), (t) => t.agentName))` (no response-shape change). §A18 comment
  updated to org-ordered-not-graded.
- read-path: the training + coach-assessment pages render the returned `team` top-to-bottom by tier.

### Fix 2: C.A.R.E Coach-Assessment roster orders by org hierarchy (+ CFO membership)
- write-path: `careCoachAssessment.ts` — select adds `role`; `withData` and `noData` both sort by `byOrgRank`
  (noData sorts the agent rows THEN projects to names, since rank needs the role). The membership `.or(...)` filter
  gains `CFO` (a CFO coach was silently excluded) — founder-approved.
- read-path: the care coach-assessment page renders agents by tier; a CFO who coaches now appears.

### Fix 3: GET /api/team orders by org hierarchy
- write-path: `api/team/route.ts` — members post-sorted by `byOrgRank` (role already selected), replacing the
  created_at order; the API twin of the already-migrated fetchTeam.
- read-path: the file-access classification picker + the finance cover-delegation dropdown (both read this endpoint)
  present people in org order.

### Gates: three order-regression guards (A30)
- write-path: `team.fetchTeam.test.ts`, `coach/sales-session/team/route.test.ts`, `careCoachAssessment.test.ts` each
  gain a scrambled-multi-tier fixture asserting C-Suite→Frontline output order (name-tiebroken; unknown→last).
- read-path: a future edit that drops a `.sort(byOrgRank)` fails these instead of silently reverting the order.

## Files
- `src/app/api/coach/sales-session/coach-assessment/route.ts` — org sort + role select
- `src/lib/data/careCoachAssessment.ts` — org sort (both lists) + CFO membership + role select
- `src/app/api/team/route.ts` — org sort on GET
- `src/lib/data/__tests__/team.fetchTeam.test.ts`, `.../sales-session/team/__tests__/route.test.ts`,
  `src/lib/data/__tests__/careCoachAssessment.test.ts` — order-regression guards

## Ripple (§6 item 5)
- All three fixes consume the single unit-tested `byOrgRank`; no new ordering logic. The CFO membership widening is
  the only behaviour change to WHO appears (additive, founder-approved). The §A18 "not a leaderboard" property holds
  — org rank is not a grade.
