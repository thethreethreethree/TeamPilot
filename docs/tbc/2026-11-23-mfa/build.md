# BUILD - Multi-factor sign-in (authenticator app)

Migration 0309. No new env keys. External precondition: TOTP MFA enabled in the Supabase project (Auth → MFA).

### Turn on sign-in codes
write-path: Settings → Sign-in codes (TwoFactorPanel) → POST /api/me/mfa (caller's session: mfa.enroll totp) → QR +
key shown → POST /api/me/mfa/verify { factorId, code } → challengeAndVerify → service role sets app_metadata.mfa = true
(setMfaFlag) → refreshSession → audit_log mfa.enabled.
read-path: GET /api/me/mfa lists the person's authenticators; the panel shows "On" and each one with Remove.

### Sign in with a code
write-path: password sign-in (unchanged) → the middleware sees app_metadata.mfa with aal1 → /login/verify → POST
/api/me/mfa/verify { code } → challengeAndVerify lifts the session to aal2.
read-path: the person lands on the page they were going to (?next=, same-site only); until then every page redirects to
the code screen and every /api route answers 401.

### Enforcement everywhere
write-path: middleware (pages and /api/:path*, getClaims verified locally; ES256) + resolveApiAuth and extensionAuth
(Bearer tokens) + 0309 restrictive `mfa_required` policy on every public table that grants access and on storage.objects
(rss_mfa_ok()).
read-path: an aal1 token of an MFA account reads 0 rows and writes nothing (PGlite replay); the live invariant lists any
access-granting table without the policy.

### Remove a lost authenticator
write-path: Team page → Reset sign-in codes (admins; not self, not another admin) → POST /api/team/mfa-reset → admin
deleteFactor for each → setMfaFlag false → audit_log mfa.reset. A person removes their own in Settings (DELETE
/api/me/mfa, needs an aal2 session).
read-path: the member signs in with the password alone; Settings → Protection's audit log shows the reset.
