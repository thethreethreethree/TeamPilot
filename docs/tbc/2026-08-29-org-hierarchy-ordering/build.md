# BUILD — org-hierarchy ordering (stage 1)

### The canonical rank (one definition)
- write-path: `roles.ts` — `orgRoleRank` (6 tiers, case-insensitive, unknown→last), `byOrgRank` comparator,
  `orgTierLabel`, `ORG_TIERS`. The org axis is separate from ADMIN_ROLES.
- read-path: any surface imports `byOrgRank` and sorts its roster identically.

### Ordering applied throughout Elostate
- write-path: sort by `byOrgRank(role, name)` in — `data/team.ts` (company team), `coach/sales-session/team`
  (sales-coach team mgmt), `care/agent/team`, `care/agent/settings/agents`, and `coach/kpi/team` (API pre-sorts +
  returns `companyRole`; the KPI page defaults Sort to "Org" and sorts by `byOrgRank(companyRole, name)`).
- read-path: every team roster reads top-to-bottom C-Suite → Frontline, A→Z within a tier.

## Files
- `src/lib/roles.ts` (+ `src/lib/__tests__/roles.test.ts`, +6 cases) — the rank foundation
- `src/lib/data/team.ts` — company team ordered
- `src/app/api/coach/sales-session/team/route.ts` — sales-coach team ordered
- `src/app/api/care/agent/team/route.ts` · `src/app/api/care/agent/settings/agents/route.ts` — Care rosters ordered
- `src/app/api/coach/kpi/team/route.ts` (+ authz test) — org-ordered + `companyRole`; `.../kpi/page.tsx` — "Org" default sort

## Ripple (§6 item 5)
- Additive: the helper is new; each surface swaps an alphabetical sort for the rank sort (name stays the in-tier
  tiebreak, so it degrades gracefully). ADMIN_ROLES / auth gates are untouched — this is display order only.
- The KPI roster's new `companyRole` is an org label (not a performance score); the §A18 allow-list test was
  updated consciously and its raw-score-leak assertions still pass.

## Honest limit (verify)
- The rank + comparator are unit-gated (12 tests). The rendered order on each roster (a client/page effect over
  live data) is founder visual-verify; the wiring is typechecked and the sort is the tested pure comparator.
- With today's data (mostly admin vs Member) the visible effect is "leadership first, staff after" — the finer
  tiers order correctly once stage 2 makes them assignable.
