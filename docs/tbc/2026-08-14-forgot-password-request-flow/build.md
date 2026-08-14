# BUILD — password-recovery REQUEST flow ("Forgot password?")

### passwordRecovery helper + drift guard
read-path: `src/lib/auth/passwordRecovery.ts` exports `RECOVER_PATH`, `recoverRedirectUrl(origin)`,
`looksLikeEmail`, `RECOVERY_REQUESTED_MESSAGE` — pure, no I/O; the request page reads them to build the redirect
and render the neutral confirmation.
write-path: none (pure module). Its correctness is locked by `src/lib/auth/__tests__/passwordRecovery.test.ts`,
which additionally asserts (structural drift-guard) that `src/app/auth/recover/page.tsx` — the redirect target —
exists on disk, so the completion page cannot be renamed/deleted out from under the flow silently.

### Password-recovery request page (/auth/forgot)
read-path: `src/app/auth/forgot/page.tsx` renders an email field + a phase state machine
(idle → submitting → sent | error); in demo mode (`!supabaseEnabled`) it states that instead of pretending.
write-path: on submit it calls `supabase.auth.resetPasswordForEmail(email, { redirectTo:
recoverRedirectUrl(window.location.origin) })` — the side effect that makes Supabase send the recovery email.
On success it shows the neutral `RECOVERY_REQUESTED_MESSAGE` (anti-enumeration); it surfaces an error only for a
real transport/rate-limit failure.

### Login pages link to recovery
read-path: `src/app/login/page.tsx` (sign-in mode) and `src/app/sales-coach/login/page.tsx` now render a
"Forgot password?" `<Link href="/auth/forgot">` under the password field — the entry point that was missing.
write-path: none (navigation only). Closes the layer-3 continuity gap: the login copy that already referenced a
"recovery link" now has a real destination, and `/auth/forgot` links back to `/login` so neither direction dead-ends.

## Test coverage
`src/lib/auth/__tests__/passwordRecovery.test.ts` (NEW): `recoverRedirectUrl` builds `<origin>/auth/recover` and
strips trailing slashes; the structural guard asserts the recover page exists on disk; `looksLikeEmail` accepts a
normal address + rejects blanks/malformed; `RECOVERY_REQUESTED_MESSAGE` stays anti-enumeration ("if an account
exists"). The client pages follow the repo convention (0 component tests — client auth pages rely on
typecheck/lint + manual/E2E).

## Out of scope (noted)
- Supabase redirect-URL allowlist (`https://elostate.com/auth/recover`) is dashboard config, not code — flagged
  in closure residual; the flow only lands cleanly if it is allow-listed.
- No rate-limit UI beyond surfacing Supabase's own error; Supabase enforces the actual throttle server-side.
