# CHECK — revision-completeness mechanism audit

Audited: the durable ledger, the gate, the two manifests, the runnable script, the protocol/proposal.

## Within-module pass (four layers)

- **1 structure:** the gate mirrors verify-residual's binds-at-closure shape and reuses lib.mjs helpers
  (jsonBlocks, currentBuildDir, repoRel) — no new idiom. The ledger is one human-first file.
- **2 effectivity — proven by detection test, not assumed.** The gate was run against a manifest with an
  un-dispositioned item and against the honest manifest:

```
=== 1. GREEN: gate against current build (all items dispositioned) ===
  · 7 requested-change item(s) in .../revision.md
✓ tbc:revision
EXIT=0

=== 2. DETECTION: break one item's disposition, expect FAIL ===
✗ tbc:revision — 1 failure(s)
  [REV-3] revision item "M1" has no valid disposition (got "").
EXIT=1

=== 3. restore the good manifest ===
✓ tbc:revision
EXIT=0
```

  The gate genuinely blocks the failure it targets (exit 1 on a partial manifest) and is green on an
  honest one (exit 0). This is the layer-2 proof: the mechanism WORKS, not merely exists.
- **3 composition:** additive — `tbc:revision` is runnable but deliberately NOT in the mandatory `tbc`
  chain, so no existing build breaks. The ledger + manifests compose (deferred items must appear in the
  ledger, REV-6).
- **4 surface:** the ledger reads top-down as "what's left + risks"; gate failures name the offending item
  id + the actionable reason.

## Cross-module pass

The gate touches no runtime code — only `scripts/tbc/` + docs + one additive npm script. It cannot affect
the app, the DB, or any existing gate. `npm run check` was run to confirm the whole system stays intact;
its output + exit code are pasted in closure.md's verification record.

## Class sweep (A26)

- **class:** "a founder revision reported done while a subset was never implemented." The sweep is the
  mechanism itself — it binds every future revision build (manifest enforced when present) and is
  retro-applied to the sales-coach incident (revision.md, SC1+SC2 both done). The honest boundary (an
  UN-declared item is not mechanically detectable) is named in revision.md + A33's manifest entry.

## Findings

No findings. The build is additive tooling + docs; the detection test exercises both gate branches; the
full-check output in closure.md confirms nothing else moved. (remediate.md omitted — no findings.)

## Inspected / not-inspected

- **Inspected:** the gate (both branches, live), the ledger content vs the real project state, both
  manifests, the npm script wiring, the full `npm run check`.
- **NOT inspected (→ residual):** the un-declarable-item hole (by construction not detectable); the
  mandatory-chain wiring (deferred to AMD-009 ratification).
