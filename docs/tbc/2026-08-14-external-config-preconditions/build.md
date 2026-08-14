# BUILD — canonical auth redirects + AMD-011 (external-config completeness)

### FIX 1 — canonical redirect origin (no more window.location.origin drift)
read-path: `src/lib/auth/passwordRecovery.ts` — new `canonicalRecoverUrl()` (= `recoverRedirectUrl(siteUrl())`)
and `signupConfirmRedirectUrl()` (= `<siteUrl>/login`), both built from the ONE configured app origin.
write-path: `/auth/forgot` → `resetPasswordForEmail(..., { redirectTo: canonicalRecoverUrl() })`; the 3 signup
flows (`/login`, `/invite/[code]`, `/redeem`) → `signUp({ email, password, options: { emailRedirectTo:
signupConfirmRedirectUrl() } })`. A reset/confirm requested from any preview/marketing domain now targets the
single allow-listed URL, so Supabase can't fall back to the Site URL.

## Config contract + audit (turn the silent precondition into a checkable one)
- `docs/AUTH-REDIRECTS.md` — required Supabase Site URL + Redirect-URLs values + an end-to-end verification
  procedure.
- `docs/CONFIG-PRECONDITIONS-AUDIT.md` — class sweep: auth surface closed (only recovery + signup use redirects);
  cron/LLM/voice fail LOUD (safe); web-push (VAPID) + care-email flagged as remaining SILENT-config surfaces.

## Amendment (§7)
- `docs/amendments/AMD-011-external-config-preconditions.md` (ratified, founder-directed).
- CLAUDE.md **§1.5.3** (external-config completeness) + §6 checklist **5c**.
- ThinkerThinker.md **A41**.
- `src/lib/constitution.ts` → version 1.11 / amendmentCount 9 / lastAmendmentId AMD-011 (INVARIANT 12).

## Test coverage
`src/lib/auth/__tests__/passwordRecovery.test.ts` (+3): `canonicalRecoverUrl()`=`<siteUrl>/auth/recover`,
`signupConfirmRedirectUrl()`=`<siteUrl>/login`, trailing-slash safe — pins that the target is the configured
app origin, not a caller-supplied origin (the drift that caused the outage).

## Notes
- No behaviour change beyond the redirect targets; recovery + signup flows otherwise unchanged.
- The config side (Supabase dashboard) is the founder's action — documented + surfaced per §1.5.3, not assumed.
