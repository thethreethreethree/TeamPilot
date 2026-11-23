# REMEDIATE - Multi-factor sign-in for owner-rights functions

### F1 - the first version would have refused the service role in a database without auth-schema grants
Fixed before applying: the rule is evaluated only when current_user is authenticated.
gate-or-promise: gate (live invariant 33 checks the hook; the replay script is in check.md)

### F2 - a held session's refusal can't be exercised end to end from here
gate-or-promise: promise (OPEN.md MFA after-push check now includes: with codes on, sign in with the password only and confirm a finance action is refused)
