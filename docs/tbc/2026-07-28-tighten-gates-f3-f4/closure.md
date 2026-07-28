# CLOSURE — gate hardening (F3 + F4)

## 1. Session-read manifest

11 entries in think.md's manifest section (the minimum set + A26/A33 for the fixes'
rationale), each with a this-session read_at and a gate-checked line range.

## 2. Build inventory (reachability)

| Component | write-path | read-path | status |
|---|---|---|---|
| `scripts/tbc/verify-freshness.mjs` (F4) | commit-msg hook + `npm run tbc` | exit code blocks commit / reds check | BUILT |
| `verify-artifacts.mjs` guard (F3) | runs in the ASSURANCE loop | suppresses the false-positive fail | BUILT |
| `package.json` + `scripts/hooks/commit-msg` | wiring | invoked by check + commit | BUILT |

## 3. Verification record (A38)

```
> execos@0.1.0 check
> ... invariant:audit && tbc && test
> execos@0.1.0 tbc
✓ tbc:docs
✓ tbc:manifest
✓ tbc:artifacts
✓ tbc:residual
✓ tbc:freshness
> execos@0.1.0 test
      Tests  1602 passed | 15 skipped (1617)
EXIT=0
```

Coverage: all gates incl. the five tbc sub-gates, exit 0. F3 + F4 live and non-breaking.

## 4. Findings ledger

No findings. F1/F2 (fixed earlier), F3 (fixed here), F4 (fixed here) — the four install-audit
findings are now all closed. Class sweep (prose-matching detectors; discretionary defenses)
turned up no further instances.

## 5. Gates added

- `tbc:freshness` — a code change touching src/scripts/migrations now fails `check` and the
  commit unless it ships its own build dir or carries a `TBC-Exempt: <reason>` trailer. This
  is the first gate that makes the per-build mandate mechanical rather than voluntary (closes
  F4 / the A38 discretionary-invocation hole).
- F3 narrows an existing gate rather than adding one.

## 6. Residual queue (A36)

```json
[
  {
    "id": "RES-2026-07-28-GH-01",
    "item": "F4's enforced-path set (src|scripts|migrations) is the right boundary.",
    "why_skipped": "Assumed obvious; felt certain these three are the code dirs and docs/ is correctly excluded.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-07-28T14:30:00Z",
    "outcome": "OPENED. Checked the repo layout: application + tooling code lives under src/ and scripts/; DB changes under migrations/. Config at root (package.json, tsconfig, next.config) is NOT enforced — a deliberate call, since a config bump is often trivial and can carry TBC-Exempt. This matches the trigger table's intent (substantive code needs a build; config/doc/trivial can be exempt). Boundary confirmed reasonable; if a future enforced dir appears (e.g. a new top-level package), add it to ENFORCED. Not a defect."
  },
  {
    "id": "RES-2026-07-28-GH-02",
    "item": "F4 behaviour on a merge/rebase whose staged set spans many commits.",
    "why_skipped": "Evaluated via the committed range (origin/main...HEAD) at CI, but not exhaustively tested for merge/rebase edge cases.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null,
    "outcome": null
  }
]
```

Top-ranked residual opened per A36; opening it confirmed the enforced-path boundary is a
deliberate, defensible call rather than an unexamined default.

## 7. Hypothesis outcomes

- **H1** (freshness gate reds code-without-a-build, passes with dir/exempt) — **CONFIRMED**.
- **H2** (F3 context requirement drops prose noise, keeps real verdicts) — **CONFIRMED**.

## 8. Doc hashes

- CLAUDE.md — `e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f`
- ThinkerThinker.md — `0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc` (re-pointed 2026-07-28 by Build B; build substance was against the pre-reconciliation `cc9071…` — see think.md re-point note)
