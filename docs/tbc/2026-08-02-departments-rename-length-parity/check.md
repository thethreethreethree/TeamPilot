# CHECK — departments rename length parity

## Audit (H1)
- The rename branch now applies the identical predicate to create (`length === 0 || length > 80`), so a name
  that create rejects is now also rejected on rename. A valid (1–80) rename is unaffected. Parity achieved.
- Confirmed no other guard existed: `departments.name` is `text NOT NULL` with no length constraint
  (0055:29); `renameDepartment` (departments.ts:100) only trims. So this route rule is the sole enforcement.
- Scope: archive/unarchive actions and the admin gate are untouched.

## Class sweep (A26)
Swept the 15 body-parsing routes with no zod schema. The DB-write core routes read (resolutions, departments)
are otherwise thoroughly hand-validated. This create/rename length asymmetry was the one real gap; the rest of
the surface is well-hardened. No further fix.

## Findings
No findings beyond the one fixed. (Positive audit result: manual validation across this surface is
consistent and defensive — the exception was the single asymmetry corrected here.)

## Verification (A38)
```
$ npx tsc --noEmit -p tsconfig.json
(no errors; no departments lines) tsc_exit=0
```
Full `npm run check` is the CI gate on push.
