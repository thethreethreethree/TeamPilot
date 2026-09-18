# REMEDIATE — the admin could see the locked-out rep and do nothing about it

### F1 — an admin can create an account and delete an account, but not restore access to one
gate-or-promise: gate

`POST /api/team/reset-password` plus a key button on the member row and a one-time copyable panel. The route
without the button would not have closed this: the escalation happened because the admin had nothing to click,
not because the capability was theoretically absent.

The gate is `src/app/api/team/reset-password/__tests__/route.test.ts` — 11 tests. The shape that matters is that
every refusal asserts `updateUserById` was NOT called, not merely that a status code came back. A refusal that
still rotated the password would be a denial with the damage already done, and a status-only test cannot see the
difference.

The happy path pins that the password sent to `auth` is the SAME string returned to the admin. That is the
failure nobody would catch by hand: a reset that reports success while the member holds a string that was never
set.

What the gate does not cover, named rather than implied: no test renders the button or the modal. The UI half is
held by typecheck alone.

### F2 — the only self-serve recovery depends on external config and has already failed silently
gate-or-promise: declined

No gate, deliberately (A33). The failure is Supabase dashboard state — a Site URL and an allowlist — which no
check in this repository can observe. A test that asserted "recovery works" would assert the code path and pass
happily through exactly the outage that produced `docs/AUTH-REDIRECTS.md`, which is worse than nothing because
it would read as coverage.

What ships instead is the thing §1.5.3 actually asks for when a precondition cannot be verified from here: a
path that does not depend on it. The reset route needs no external config — a service-role write and a string on
screen — so when the emailed link silently falls back to the wrong project, the admin now has something that
works regardless.

The doc remains the record for the email flow itself; this build does not touch it and does not claim to have
fixed it.

### F3 — the obvious version of this feature is an account-takeover path
gate-or-promise: gate

Refused for admin targets (403) and for self (400), each pinned by a test that also asserts no credential was
touched.

The self refusal is deliberately separate from the admin refusal even though today it is redundant — the caller
must be an admin to reach the endpoint, so their own row is already an admin row. Relying on that coincidence
would break silently the moment the role model changes, which is the §2.2 shape: a decision that happens to be
right for a reason it does not state.

Proven by mutation rather than asserted:

    dropped the isAdminRole(target.role) refusal
    -> × an ADMIN target -> 403; this endpoint is not an account-takeover path
       AssertionError: expected 200 to be 403

What is NOT gated here, and is the honest limit: nothing prevents a widening of this rule from being made
casually later. The refusal is one `if` with a comment explaining that widening is a founder decision. If it is
widened, the test above fails and must be deliberately edited — which is the friction, and it is friction rather
than prevention.
