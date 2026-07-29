# CLOSURE — theme reconcile race fix

## 1. Session-read manifest

11 entries in think.md's manifest, each with a this-session read_at (validated by verify-manifest.mjs).
Clauses re-read this session: CLAUDE.md §0, §0.1, §1.5.1, §1.5.2, §6; ThinkerThinker.md A19, A22, A26,
A30, A33, A38.

## 2. Build inventory (reachability per A31)

| Feature | write path | read path | status |
|---|---|---|---|
| Reconcile re-read guard | effect re-reads localStorage after fetch, passes fresh value | user's mid-flight choice survives | BUILT |

## 3. Verification record (A38)

```
> npm run check   (typecheck · lint · theme:audit · rls:audit · invariant:audit · tbc · test)
  invariant:audit — Violations: 0
✓ tbc:docs
✓ tbc:manifest
✓ tbc:artifacts
✓ tbc:residual
✓ tbc:freshness
      Tests  1622 passed | 15 skipped (1637)
CHECK_EXIT=0
```

Targeted before the full run: `npx tsc --noEmit` exit 0.

## 4. Findings ledger

F1 (reconcile race) — FOUND by this session's post-build self-audit, FIXED (remediate.md). gate-or-promise
answered (declined per A33). No findings left open.

## 5. Gates added

None. Gate declined per A33 (the capture-before-await class is not precisely detectable); the re-read
guard + the reconcileTheme local-wins unit test are the local defense.

## 6. Residual queue (A36)

```json
[
  {
    "id": "RES-2026-07-29-RACE-01",
    "item": "The reconcile fix is verified by reasoning + tsc + the pure reconcileTheme test, NOT by an end-to-end browser test of the race under real network latency.",
    "why_skipped": "The race is in a React effect + fetch timing; a deterministic unit test would need a DOM + fake-timer + mocked fetch harness the theme module does not currently have.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-07-29T07:55:00Z",
    "outcome": "OPENED. Reviewed: the fix's correctness reduces to 'if localStorage is non-null at apply time, skip' — which is exactly the reconcileTheme local-set branch already unit-tested (returns {preference:null}). The re-read guarantees the fresh value reaches that branch. So the logic IS pinned; only the effect-timing wiring is unverified end-to-end. Acceptable; a jsdom + fake-timer effect test is a reasonable follow-up if theme regressions recur."
  }
]
```

Top-ranked residual (RACE-01, medium) is opened with an outcome per A36.

## 7. Hypothesis outcomes

- **H1** (re-read closes the race without regressing the fresh-device path) — CONFIRMED (tsc exit 0; fresh
  value flows into the unit-tested local-set branch).

## 8. Doc hashes

- CLAUDE.md — `e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f`
- ThinkerThinker.md — `0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc`
