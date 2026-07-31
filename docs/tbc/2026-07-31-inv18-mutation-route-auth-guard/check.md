# CHECK — INV18 mutation-route auth guard

## Audit of the build

- **No false positive** — the audit reports 0 violations on the current tree, so every real mutation
  route is correctly classified as gated or justifiably-public (H1 confirmed).
- **The allowlist is justified, not blanket** — all 10 entries were individually verified safe-to-be-
  anonymous (deprecated stubs / rate-limited health/demo / pre-auth code check / embed-token widgets),
  not waved through. `resolveCareTenant` is excluded from the gate matcher precisely so a new public
  widget route can't pass silently.
- **Self-test coverage** — the added `st(...)` cases assert BOTH directions (rejects an ungated body,
  accepts each real gate shape) so a future edit that weakens the matcher fails the self-test rather than
  silently printing 0.

## Findings

**No findings.** The guard is precise (mutation-scoped, dedicated-invariant trees skipped), justified
(each public route reasoned), and self- + detection-tested.

## Verification (canonical command + end-to-end detection test)

The audit is clean on the real tree, FIRES on a synthetic ungated mutation route, and correctly IGNORES
a GET-only version — **audit exit 0 when clean**:

```
=== audit WITH an ungated probe route present (expect INV18 to FIRE) ===
  Violations:           1
✗ Mutation route without a recognised auth/tenant gate
    src/app/api/_tmp_inv18_probe/route.ts
=== GET-only version of the same route (must NOT fire) ===
  Violations:           0
=== probe removed; clean again ===
  Violations:           0
EXIT=0
```

This is a genuine detection test: the guard proved it flags the exact diagnosis/close shape (a POST that
reaches `sb.rpc('close_problem', …)` with no gate) and that its scope is mutation-only (a GET is ignored).
Combined with the 9 synthetic self-tests, both the matcher and the end-to-end wiring are locked.
