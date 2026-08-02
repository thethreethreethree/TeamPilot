# CLOSURE — Sales-Coach area access gate as a pure, tested predicate

## What shipped
The `/dashboard/sales-coach` layout access gate now routes through a pure, unit-tested predicate
`isSalesCoachMember` instead of an inline `isCompanyAdmin || hasSalesCoachRole`. A future edit that weakens who
may enter the Sales-Coach area now fails CI, matching (a) `skillAccess.ts`'s own stated doctrine for its manager
gate and (b) how the sibling `/dashboard/care` gate routes through the tested `deriveCareAccess`. Behavior is
identical; the value is the CI guard on a security gate.

## Un-named reliance (not self-evident)
- **This changed NO ONE's access.** The predicate is provably the same boolean as before; the redirect fires
  for exactly the same callers. Do not read this as a policy change — it is factoring + a regression test.
- **`isSalesCoachMember` is deliberately WIDER than `isSalesCoachManager`.** Member (admin|staff|company-admin)
  = may ENTER their own area; Manager (admin|company-admin) = may view OTHER reps' data. The one pinned test
  (staff = member true / manager false) is the guardrail: a future refactor that "unifies" the two predicates
  would lock staff reps out and this test would catch it. Keep them distinct.
- **The layout passes `company_id: null` into the predicate on purpose** — membership does not depend on the
  tenant match (that's the manager/`canManagerViewRepSkills` concern); the `SkillViewer` shape just requires the
  field.
- **Single-site, by audit.** No other inline copy of this membership gate exists (A26 sweep). This is hardening,
  not de-duplication — stated so the next reader doesn't hunt for phantom call sites.

## Flagged, not fixed (§3.3)
- none. This build introduced no adjacent decisions; the module-access audit that preceded it separately
  confirmed the care gate closed and both layouts otherwise correct.

## Residual (A36)
```json
[
  { "id": "RES-01", "item": "No render-level test of the layout's redirect branch (server component); the predicate is unit-tested, the layout wiring is by-inspection.", "why_skipped": "The security decision now lives in the pure tested predicate (the point of the extraction); a Next server-component render harness for a 1-line redirect is high-cost, low-marginal-value.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-02T03:43:22Z", "outcome": "OPENED — the extracted predicate carries the CI guard; the layout is a thin caller identical in shape to the care sibling." }
]
```
