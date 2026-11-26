# BUILD - Acting on the review of the reporting-tree fixes

No migration. No env keys.

### A manager changes a team member's Sales Coach role
write-path: POST /api/coach/sales-session/team {id, salesCoachRole} → treeAllowsRep(target) (own role excepted) → profiles.sales_coach_role, as before; outside the tree → 404, nothing written.
read-path: the roster.

### A manager opens calibration in a large company
write-path: none.
read-path: GET /api/coach/gamification/calibration → after_pitch pages of 500 (≤10) → sessions in chunks of 150 → tree (checked) and hides → the pool (≤500).

### A team view whose tree check fails
write-path: none.
read-path: session list / coach-assessment → { degraded: true }; team-activity / usage → 500.
