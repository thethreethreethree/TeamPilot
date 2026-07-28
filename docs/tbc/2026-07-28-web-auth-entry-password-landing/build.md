# BUILD — auth-entry (Task 1 + Task 2)

New: `src/components/ui/PasswordInput.tsx`, `src/lib/nav/landing.ts`,
`src/app/api/me/landing/route.ts`. Edited: `login/page.tsx`, `redeem/page.tsx`,
`api/pilot/redeem/route.ts`, `auth/recover/page.tsx`, `invite/[code]/page.tsx`,
`sales-coach/login/page.tsx`, `settings/ChangePasswordPanel.tsx`.

### Show-password toggle (Task 1)

- files: `src/components/ui/PasswordInput.tsx` + 6 call sites (login, redeem, auth/recover ×2,
  invite/[code], sales-coach/login, ChangePasswordPanel ×2).
- write-path: **exists** — the user clicks the eye button (`PasswordInput.tsx:33` `onClick`
  → `setShow`). human_can_set: **yes** (a real, keyboard-reachable `<button>` with aria-pressed).
- read-path: **exists** — the input's `type` flips to `"text"` (`PasswordInput.tsx:27`), so the
  typed characters render. human_can_see: **yes** — that IS the feature.
- reachability: **BUILT.** `grep 'type="password"'` across the 6 files → 0 remaining; all are
  `<PasswordInput>`, each preserving its `autoComplete`/`required`/`disabled`/`className`.

### Module-aware login landing (Task 2)

- files: `src/lib/nav/landing.ts` (`moduleLanding` + `resolveUserLanding`),
  `src/app/api/me/landing/route.ts`, `src/app/login/page.tsx`, `src/app/api/pilot/redeem/route.ts`.
- write-path: **exists** — the module a user has is written at provisioning: `care` →
  `care_tenant_config` row, `sales_coach` → `profiles.sales_coach_role` (redeem_pilot_code /
  onboarding). `resolveUserLanding` (`landing.ts:38`) reads those levers. human_can_set:
  **yes, indirectly** — their module provisioning determines the landing, by design.
- read-path: **exists** — `login/page.tsx` (sign-in success) fetches `/api/me/landing` and
  `router.push(buildDestination(base))` — the resolved landing is actually navigated to.
  human_can_see: **yes** — a care-only user arrives at `/dashboard/care`, not the hub.
- reachability: **BUILT.** The redeem flow now returns `moduleLanding(mod)` from the SAME map
  (`redeem/route.ts`), so login and redeem cannot diverge (A21 closed). `safeNext`
  (extension) and `intent` precedence inside `buildDestination` are preserved.

## Not in this build (flagged, not silently dropped)

- Signup sets no `emailRedirectTo`, so the email-confirm link uses Supabase's Site URL — a
  config check (`NEXT_PUBLIC_SITE_URL`), out of code scope. Recorded in closure residual.

## Verification (A38)

Canonical `npm run check` output + exit code are pasted in closure.md's verification record.
