# CHECK — vendor-CRM shell gate (/dashboard/admin/crm)

## Audit (H1)
- The layout gate evaluates `isVendorAdmin(getCurrentAuthContext(), getVendorCompanyId())` — byte-identical to
  what `requireVendorAdmin` runs on every CRM API route. So a real vendor admin who already reaches the CRM data
  passes the shell gate too (no lock-out), and a non-vendor (incl. a company admin) gets `notFound()` server-side
  before any child renders (no shell flash, and — matching the API's stated posture — no confirmation the area
  exists).
- Behavior-preserving for the DATA boundary: every CRM route already enforced `requireVendorAdmin` (0089), so no
  data exposure existed or changes; this closes only the shell/existence exposure.
- `isVendorAdmin` is null-safe (`ctx==null`, non-admin, or no companyId → false), so an unauthenticated or
  demo-mode request 404s rather than throwing.

## Class sweep (A26)
Behavioral sweep of all `/dashboard/admin/*` + `/founder/*` gates: founder pages (server `isVendorAdmin` →
notFound) ✓; admin asset-readout / coach-readout (`ctx.isAdmin`; coach-readout companyId-scoped) ✓; team-check
(`isAdminRole`) ✓; crm API (`requireVendorAdmin`) ✓. The crm PAGE TREE was the sole surface missing a server gate.

## Findings
no findings in this build's own change — the gate reuses an already-tested predicate and is behavior-preserving
on the data boundary. One ADJACENT, lower-severity item was FLAGGED, not fixed (§3.3): the company-admin admin
pages (asset-readout / coach-readout / feedback) are client shells whose data is `isAdmin`-gated (no leak) but
which lack a layout-level redirect for non-admins — a UX/defense-in-depth improvement mirroring the care gate,
left as a founder decision (multi-page redirect + predicate choice). → founder queue.

## Verification (A38)
```
$ npx tsc --noEmit -p tsconfig.json
(no errors on src/app/dashboard/admin/crm/layout.tsx) tsc_exit=0

$ npx vitest run src/lib/crm/__tests__/vendorAuth.test.ts
 Test Files  1 passed (1)
      Tests  8 passed (8)
```
Full `npm run check` is the CI gate on push.
