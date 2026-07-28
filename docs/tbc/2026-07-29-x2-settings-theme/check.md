# CHECK — Settings Slice 1 (Theme) audit

Audited the built files: migration 0201, the /api/me/theme route, the ThemeProvider reconcile+persist,
the ThemePanel, the settings-page wire, the reconcileTheme test.

## Within-module pass (four layers)

- **1 structure:** the resolution rule is a pure exported `reconcileTheme` (not buried in an effect);
  the route mirrors the established `/api/me/learning-mode` shape.
- **2 effectivity:** tsc exit 0; reconcileTheme 6/6. Full `npm run check` output + exit code in
  closure.md's verification record.
- **3 composition:** `setPreference` gains a fire-and-forget DB persist — a strict superset, so the
  existing ThemeToggle and the learning-mode dark-flip keep working (the flip now also persists dark,
  which is consistent, not a regression). The pre-paint/localStorage path is untouched.
- **4 surface:** an Appearance card with a per-user segmented control + an admin-only company-default
  control, styled to match the other Settings cards.

## Cross-module pass

- `profiles.theme_preference` is not on the 0090 privileged-column guard, so self-RLS permits the user's
  own write — no guard change, no cross-tenant exposure (writes are `.eq("id", ctx.userId)` and the
  company default is `.eq("id", ctx.companyId)` behind an `isAdmin` re-check).
- The route never uses the admin/service-role client — both writes are RLS-scoped through the user
  client, so there is no service-role tenant-scoping risk here (that risk is deferred to the
  Access-Assistance slice, which will need it).

## Class sweep (A26)

- **class:** a migration-coupled surface that breaks when the migration is not yet applied (the
  2026-07-03 outage class). sweep: every DB touch in the new route is wrapped with
  `isMissingColumnError` for the exact column; the ThemeProvider reconcile is guarded (any fetch failure
  → localStorage-only). `grep "from(\"profiles\")\|from(\"companies\")" src/app/api/me/theme` → 3 touches,
  all guarded. No unguarded new column read/write.

## Findings

No findings. Additive, guarded, tsc-clean, unit-pinned. (remediate.md omitted — no findings.)

## Inspected / not-inspected

- **Inspected:** all six changed files; the 0090 guard interaction; the admin gate (server-side 403);
  the guarded-fallback predicate; tsc + the reconcileTheme test.
- **NOT inspected (→ residual):** live behavior against an APPLIED 0201 (migration not applied by me —
  needs the DB URL / founder); the one-frame reconcile flash for company-default users on first load.
