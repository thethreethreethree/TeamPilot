# BUILD - Multi-factor sign-in for owner-rights functions

Migration 0315 (applied). No env keys or dashboard settings (a database role setting, applied by the migration).

### A held session can't call owner-rights functions
write-path: none (a guard).
read-path: every REST request → PostgREST pre-request hook public.rss_pre_request() → for a signed-in caller on
/rpc/* whose token says codes are on and this session hasn't passed one (rss_mfa_ok() false): 42501 "Enter the code
from your authenticator app to continue." Everyone else passes; tables keep 0309's policy.
