# CHECK — a shared password nobody is forced to rotate is not temporary

## Findings

### F1 — a forced password rotation that only guards one of the product's two front doors
class: gate-enforced-at-one-surface (a security decision placed on the path its author was looking at, not on every path that reaches the resource)
sweep: grep `must_change_password` across `src/`; read the middleware `config.matcher`; read the extension's auth helper for what it actually resolves; then confirm a session is issued while the flag is set
severity: high

`must_change_password` was enforced only in `src/app/dashboard/layout.tsx`. The middleware matcher
lists `/dashboard`, `/onboarding`, `/login`, `/sales-coach/login` — `/api/*` is not covered — and
`requireEntitledExtensionUser` checks Bearer auth plus company entitlement, never the flag.

The route that sets the flag distributes a **shared** team password to several hires by design. A
rep who lives in the extension never meets the redirect, so that shared secret stays live on their
account indefinitely. Observed, not reasoned: a password grant for an account carrying the flag
returned a valid `access_token`, and the profile read back through RLS confirmed
`must_change_password: true` on the same account.

### F2 — every member added through "Add agent" was named after their email prefix
class: regression-behind-a-faster-path (a new streamlined route silently dropped a field the path it replaced captured)
sweep: read `handle_new_user`'s coalesce; grep `user_metadata` / `full_name` in the add and accept routes; compare against the older invite path
severity: low

`handle_new_user` (0011) falls back to `split_part(new.email,'@',1)`. `add-member` passes no
`user_metadata`, so the fallback always won. `accept/route.ts` already captured `p_full_name`; the
2026-08-21 fast build did not. Confirmed against live data: the member created by this task landed
with `full_name: "naryk333"`.

Not a cosmetic-only defect — this name is the rep's identity on the Sales Coach leaderboard.

### F3 — the suite used to verify all of the above was not running a third of itself
class: instrument-failure-reported-as-environment-noise (a true red whose own summary argues for dismissing it)
sweep: run the canonical `npm test`, read the failure class rather than the count, then re-measure the exit code under the old configuration instead of assuming it
severity: medium

352 of 647 test files failed to import with `ERR_MODULE_NOT_FOUND` on `@/…`, taking 2222 tests.

The correction that matters: the run **did** exit 1 — measured, not assumed. An earlier draft of
this finding claimed the suite had been quietly reporting success, which would have been a more
alarming story and a false one. What is true is narrower and still worth fixing: the per-test line read `2110 passed | 0
failed`, so the failure presented as a toolchain problem to be worked around rather than a third of
the suite being absent.

## What I did NOT do

`resolveApiAuth` is a second Bearer-token path with the identical gap — 12 routes, including KPI,
leaderboard, gamification and sales-session CRUD. Its own header says it "mirrors the already-proven
extension auth," which is the §2.2 duplicated-decision shape stated outright in the source.

The founder was given this against a middleware-wide option and chose the narrow extension fix, so
it is left open on purpose and carried in the residual. It is named here so that a future reader
does not take this build as having closed the class.

Also not done: the two accounts this task provisioned were not exempted from the new gate. They
carry the flag, so they must set a password via the web app before the extension will serve them.
That was surfaced to the founder as an operational instruction rather than worked around by
clearing the flag, because clearing it would leave the generated temporary passwords live — the
exact condition F1 exists to end.

## Verification

    $ npx tsc --noEmit
    exit 0

    $ npx vitest run src/lib/api/__tests__/extensionAuth.test.ts
    Test Files  1 passed (1)
    Tests  17 passed (17)

    $ npm test          # before the config fix, measured deliberately
    Test Files  352 failed | 294 passed | 1 skipped (647)
    Tests  2110 passed | 15 skipped (2125)
    EXIT_CODE=1

    $ npm test          # after
    Test Files  646 passed | 1 skipped (647)
    Tests  4336 passed | 15 skipped (4351)
    exit 0

    $ npm run lint
    exit 0

    $ npm run rls:audit
    Tenant-pin risks: 0 · Missing policies: 0 · RLS-bypassing views: 0
    exit 0

    $ npm run invariant:audit
    Files scanned: 1023 · Documented exceptions: 38 · Violations: 0
    exit 0

    $ npm run theme:audit
    Theme-bound leaks: 0
    exit 0

Not run on a live extension client. The 403 and its `code` are asserted by tests and by reading
`background.js`'s error forwarding; no browser was driven against a deployed build, and that is
stated rather than implied.
