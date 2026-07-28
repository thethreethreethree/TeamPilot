# BUILD — Settings Slice 1: Theme

Files: `supabase/migrations/0201_settings_theme_prefs.sql`, `src/app/api/me/theme/route.ts`,
`src/components/theme/ThemeProvider.tsx` (reconcile + persist), `src/components/settings/ThemePanel.tsx`,
`src/app/dashboard/settings/page.tsx` (wire), `src/components/theme/__tests__/reconcileTheme.test.ts`.

### Per-user theme override (persisted cross-device)

- write-path: **exists** — ThemePanel "Your theme" buttons call `setPreference`, which applies to the
  DOM + localStorage AND fire-and-forgets `PATCH /api/me/theme {preference}` → `profiles.theme_preference`
  (self-RLS). human_can_set: **yes** — the segmented control.
- read-path: **exists** — on a fresh device with no local choice, ThemeProvider fetches
  `GET /api/me/theme`, and `reconcileTheme` applies the personal DB pref (cached) → painted via
  `applyToDom`. human_can_see: **yes** — the theme follows the user to a new device.
- reachability: **BUILT** — tsc exit 0; reconcileTheme unit test 6/6.

### Company default theme (admin-set, company-scoped)

- write-path: **exists** — ThemePanel "Company default" buttons (admin-only render) call
  `PATCH /api/me/theme {companyDefault}`; the route re-checks `ctx.isAdmin` and updates
  `companies.default_theme` scoped to `ctx.companyId`. human_can_set: **admins only**.
- read-path: **exists** — a member with no personal preference gets `companyDefault` from
  `GET /api/me/theme`; `reconcileTheme` applies it (not cached, so it keeps tracking changes).
  human_can_see: **yes** — new members start on the house theme.
- reachability: **BUILT** — the admin gate is server-side (403 for non-admins), not just a hidden button.

### Migration + guarded fallback (A34)

- write-path: **exists** — `0201` adds `profiles.theme_preference` (nullable, not in the 0090 guard) +
  `companies.default_theme` (not-null default 'system'). human_can_set: applied via `npm run db:apply`.
- read-path: **exists** — every DB touch in the route is wrapped with
  `isMissingColumnError(err, '<col>')`; a pending 0201 degrades GET to null and PATCH to a soft 409, and
  the ThemeProvider keeps localStorage-only behavior. human_can_see: no broken page pre-migration.
- reachability: **BUILT** — guard predicate is the unit-pinned migrationGuard helper.

## Verification (A38)

`npm run check` output + exit code in closure.md's verification record.
