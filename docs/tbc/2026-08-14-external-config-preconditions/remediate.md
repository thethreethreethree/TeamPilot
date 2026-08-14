# REMEDIATE — canonical auth redirects + AMD-011

## F1 — canonical redirect origin + verified config contract
Remediation: all auth email-redirects build from `siteUrl()` (one canonical origin) via `canonicalRecoverUrl()` /
`signupConfirmRedirectUrl()`; `docs/AUTH-REDIRECTS.md` records the required Supabase config + an end-to-end
verification procedure; the class is amended into the constitution (§1.5.3 / A41 / checklist 5c).
gate-or-promise: gate. `passwordRecovery.test.ts` pins the canonical helpers (target = configured app origin,
never a caller origin); a call site reverting to `window.location.origin` no longer routes through the guarded
helper. CLAUDE.md §6 item 5c makes the external-config check a standing checklist gate; INVARIANT 12 pins the
amendment metadata. class: external-config completeness. severity: critical. Fixed (code) + documented (config) +
amended (structural).

## R1 — the config side is external (founder action, named per §1.5.3)
gate-or-promise: promise. The Supabase Site URL + Redirect-URLs allowlist is a dashboard setting the repo cannot
enforce. Per §1.5.3 it is DOCUMENTED as a blocking setup step (`docs/AUTH-REDIRECTS.md`) with a verification
procedure and surfaced to the founder — not silently assumed. Closed when the founder applies + verifies it.

## R2 — remaining silent-config surfaces (VAPID push, care-email)
gate-or-promise: promise. Flagged in `docs/CONFIG-PRECONDITIONS-AUDIT.md` as the same class; the recommended fix
is a health-visibility flag (`pushConfigured`/`emailConfigured`) so they fail LOUD. Not built here (each a small
deliberate add) — named so they aren't mistaken for working. Founder-gated.
