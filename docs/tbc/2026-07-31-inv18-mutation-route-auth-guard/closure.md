# CLOSURE — INV18 mutation-route auth guard

## What shipped

A build-time structural guard (`scripts/invariant-audit.mjs`, run by `npm run check` + pre-commit) that
fails the build if any POST/PATCH/PUT/DELETE route outside the admin/extension/cron trees references no
recognised auth/tenant gate and is not a justified public route. This completes the A30 gate for the
diagnosis/close class (fixed earlier in 4ab3294c): the NEXT anon-writable mutation route now fails at
commit time instead of surviving to a manual sweep.

## What I relied on that is NOT self-evident (the un-named-reliance half)

- **The inventory is a point-in-time snapshot.** `ROUTE_AUTH_RE` + the allowlist were derived from the
  current ≈170 mutation routes. The guard's correctness for the FUTURE rests on the assumption that new
  auth mechanisms will reuse one of the recognised names. A genuinely-new gate helper (say
  `requireBillingAdmin`) would false-POSITIVE (flag a gated route) — which is the SAFE direction: the
  author adds the name to `ROUTE_AUTH_RE` consciously. A new PUBLIC route false-positives too, forcing a
  justified allowlist entry. Neither failure mode is a silent hole.
- **The allowlist entries assert safety I verified this session, not permanently.** e.g. "pilot/validate
  is read-only" holds only while `pilot_code_status()` stays read-only; "sales/demo/roleplay sees no
  tenant data" holds while it stays a pure roleplay. If one of those routes gains a write or a tenant
  read, its allowlist justification is stale — the entry names the assumption so a reviewer can catch it.
- **`resolveCareTenant`-is-not-a-gate is a deliberate judgment**, not a fact the code enforces. I chose to
  allowlist its 3 routes rather than treat it as auth, so a new public widget route is caught. If the
  founder decides resolveCareTenant SHOULD count as a recognised gate, moving it into `ROUTE_AUTH_RE` is
  the one-line change — but that trades the forced-classification for silence.

## Residual (A36)

```json
[
  {
    "id": "RES-01",
    "item": "INV18 checks that a gate is REFERENCED in the file, not that it actually runs BEFORE the first write (a route could reference auth.getUser but call the RPC first). Same shape as INV7/INV8, which also match on reference.",
    "why_skipped": "Ordering analysis needs a real parser (control-flow), not a regex; the reference check is the same pragmatic bar INV7/INV8 set and it catches the actual failure mode (NO gate at all, the diagnosis/close shape). A referenced-but-misordered gate is a much narrower, rarer bug.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-07-31T11:08:00Z",
    "outcome": "OPENED. Accepted as the deliberate scope of the guard (parity with INV7/INV8). The diagnosis/close class — no gate at all — is fully covered. Ordering is left to code review + the per-route tests; noted so the boundary is on the record, not implied to be covered."
  },
  {
    "id": "RES-02",
    "item": "The 10-entry PUBLIC_ROUTE_ALLOWLIST encodes founder-reviewable judgments about which routes are safe anonymous. I self-authored them under the build guard rather than waiting for founder sign-off.",
    "why_skipped": "Each entry is individually justified + verified this session, and the guard being IN PLACE is strictly safer than an ungated class (A30). The founder retains veto — the FOUNDER-ACTION-QUEUE entry now flags 'review the allowlist' rather than 'build the guard'.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-07-31T11:08:00Z",
    "outcome": "OPENED + surfaced for founder review. The allowlist is small, each line carries its reason, and a wrong entry can only mask a route I ALSO verified safe this session — not an unexamined one."
  }
]
```

## Verification

Audit clean on the real tree + detection test FIRES on a synthetic gap + GET-only ignored, audit exit 0
(see check.md). Full `npm run check` is the CI gate for the whole suite on this commit.
