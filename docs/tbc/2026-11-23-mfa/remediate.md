# REMEDIATE - Multi-factor sign-in

### F1 - owner-rights database functions are outside the database rule
Not changed in this build. Pages, every /api route, every access-granting table and storage are guarded; the 128
SECURITY DEFINER functions each need reading before `rss_mfa_ok()` is added to the data-bearing ones.
gate-or-promise: promise (OPEN.md "128 SECURITY DEFINER functions…" — the next build; the sweep query in check.md is its count)

### F2 - the mobile app and Chrome extension cannot ask for a code
Both Bearer paths refuse an aal1 token of an MFA account (fail closed, not open); the Settings panel states the limit
before anyone turns codes on.
gate-or-promise: promise (OPEN.md "the mobile app and Chrome extension have no code step")
