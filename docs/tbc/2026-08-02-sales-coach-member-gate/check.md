# CHECK — Sales-Coach area access gate as a pure, tested predicate

## Audit (H1)
- `isSalesCoachMember` returns true for `sales_coach_role` admin|staff and for role CEO/COO/admin; false for a
  plain member (no sales_coach_role) and for null/null. This is provably the same boolean the layout computed
  inline (`isCompanyAdmin || hasSalesCoachRole`), so the SAME callers are redirected — behavior-preserving.
- The predicate is STRICTLY WIDER than `isSalesCoachManager`: the pinned test asserts a staff rep is
  `member=true` and `manager=false`. This is the failure mode the extraction exists to prevent (never lock a
  staff rep out by conflating the access gate with the manager gate).
- No route, schema, auth rule, or metric value changed — only the factoring of one gate + its test.

## Class sweep (A26)
Swept `src/app` + `src/components` for other inline membership gates (`!!sales_coach_role` combined with a
company-admin role check). The layout was the SOLE site; all 18 `skillAccess` importers use the *manager*
predicate. Single-site hardening, not multi-site consolidation — stated honestly, no dropped instances.

## Findings
no findings — the change is behavior-preserving and the new predicate is covered by 4 unit tests including the
member ⊋ manager pin.

## Verification (A38)
```
$ npx tsc --noEmit -p tsconfig.json
(no errors on skillAccess.ts or sales-coach/layout.tsx) tsc_exit=0

$ npx vitest run src/lib/coach/v5/__tests__/skillAccess.test.ts
 Test Files  1 passed (1)
      Tests  11 passed (11)
```
Full `npm run check` (typecheck + lint + audits + tbc + ~2189 tests) is the CI gate on push.
