# CHECK — assignable org tiers (stage 2)

## Gate — the canonical command (A38)
```
$ npm run check     # tsc --noEmit && eslint && theme:audit && rls:audit && invariant:audit && tbc && test
> typecheck / lint / theme:audit / rls:audit / invariant:audit (0 violations) — pass
> tbc:docs / tbc:manifest / tbc:artifacts / tbc:residual / tbc:freshness — pass
> test   Test Files  594 passed | 1 skipped (595)
        Tests  3925 passed | 15 skipped (3940)
PIPE_EXIT=0
```

## What the tests lock (A30)
- `set-role/route.test`: 401 unauth · 403 non-admin · 400 non-assignable role (no write) · 404 member-not-in-company
  (INV15 tenant-pin) · 409 last-admin lockout refused (no write) · 200 demote-with-a-spare-admin · 200 non-demotion
  without touching the admin count.
- `roles.test` + `authHelpers.isAdminRole.test`: ADMIN_ROLES now = the C-Suite tier (CEO/CFO/COO/admin), a conscious
  expansion; `isAssignableOrgRole` accepts the 8 tier roles and rejects everything else.

## Not unit-gated (founder visual-verify)
- The per-member org-role dropdown rendering + the live set-role round-trip on the team page (client page, no jsdom
  harness). The route's security + safety are unit-gated; the wiring is typechecked.

## Findings
No findings — the write is admin-gated + service-role + tenant-pinned + lockout-safe; the CFO admin expansion is a
new value with its pinned tests updated consciously.
