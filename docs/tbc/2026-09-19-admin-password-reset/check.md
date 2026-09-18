# CHECK — the admin could see the locked-out rep and do nothing about it

## Findings

### F1 — an admin can create an account and delete an account, but not restore access to one
class: workflow-dead-end-inside-the-product (the next step in the admin's own sequence has no in-product action, so every instance escalates out)
sweep: list every route under `src/app/api/team/`; read what each password route is actually for; then read the member row in the team page for what an admin can DO to a member
severity: high

The team API is `accept`, `add-member`, `passwords`, `route`, `set-password`, `set-role`. `set-password` is the
member's own and requires them to already be signed in — the thing a locked-out member cannot do. `passwords`
is shared team passwords, used when CREATING a user. Nothing resets an existing member's credential.

The member row offers a role selector and a remove button. So the admin, looking straight at the person who
cannot get in, has no action available.

Counted rather than supposed: three credential operations were performed by hand for one team in one session
(one account created, two passwords reset), each by an agent running a service-role script.

### F2 — the only self-serve recovery depends on config the repo cannot hold, and has already failed silently
class: external-config-precondition (§1.5.3 — correct code, unmet precondition, silent failure)
sweep: read `docs/AUTH-REDIRECTS.md`; confirm what the recovery flow depends on and whether that dependency is verified or merely assumed
severity: medium — and it is the reason F1 bites rather than being a theoretical gap

`/auth/forgot` sends an emailed link. `docs/AUTH-REDIRECTS.md` exists because that link broke on 2026-08-14:
Supabase silently falls back to the Site URL for any `redirectTo` not in its Redirect-URLs allowlist, and reset
links opened the marketing project instead of the form. The recovery code was correct on both ends.

That doc records the code-side invariant as done. What it cannot do is guarantee the dashboard config, and it
cannot make the mail arrive. With no in-product fallback, every failure of that flow becomes a human escalation.

### F3 — the obvious version of this feature is an account-takeover path
class: privilege-escalation-by-convenience (a helpful admin action that reaches accounts at or above the caller's authority)
sweep: ask who the caller can target, and what the most privileged reachable target is
severity: high if built naively — this is a finding about the fix, caught before shipping rather than after

Admin is the top of this product's authority, so an admin-initiated reset that can target another admin escalates
to *someone else's account*, including the owner's. Refused for admin targets, and refused separately for self.

## What I did NOT do

The new UI was not opened in a browser. The button, the modal, the copy affordance and the amber partial-failure
note are asserted by typecheck and by the route's own tests; nothing rendered them. `npm run build:ci` was
attempted twice to at least prove the production build compiles and was blocked both times by the sandbox
permission classifier. That is flagged to the founder as a permission needed, not worked around.

The reset flow was also not exercised end-to-end against the live app — the three resets this session informed
it were performed by direct service-role script, not through this route.

No audit event is written on reset. §3.1 makes events the spine of this system, and "an admin rotated a
colleague's credential" is exactly the kind of fact that should be on an append-only record. The team routes do
not currently emit events for `set-role` or removal either, so adding one only here would be a half-measure
pretending to be coverage. Carried as a residual rather than done badly.

## Verification

    $ npx tsc --noEmit
    exit 0

    $ npx vitest run src/app/api/team/reset-password
    Test Files  1 passed (1)
    Tests  11 passed (11)

    $ npx vitest run src/lib/auth
    Test Files  8 passed (8)
    Tests  66 passed (66)

    $ npm test
    Test Files  649 passed | 1 skipped (650)
    Tests  4366 passed | 15 skipped (4381)
    exit 0

    $ npm run lint
    exit 0

    $ npm run rls:audit
    Tenant-pin risks: 0 · Missing policies: 0 · RLS-bypassing views: 0
    exit 0

    $ npm run invariant:audit
    Files scanned: 1025 · Violations: 0
    exit 0
    # includes "every admin route gated" — the new route satisfies it

    $ npm run theme:audit
    Theme-bound leaks: 0
    exit 0

    $ npm run build:ci
    BLOCKED by the sandbox permission classifier (twice). The Next production build is UNVERIFIED.
