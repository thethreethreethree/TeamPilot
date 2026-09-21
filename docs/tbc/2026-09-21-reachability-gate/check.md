# CHECK

## Commands run, by the project's own names

| Command | Result |
|---|---|
| `npm run reachability:audit` | 1,711 files, 6 documented exceptions, **0 violations** |
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | clean |
| `npm run invariant:audit` | **0 violations** |
| `npx vitest run` | **4,691 passed**, 15 skipped |

## The gate was proven, twice

Not reasoned about — a module nothing imports was planted and the gate was run.

| | Result |
|---|---|
| `src/lib/__orphan_probe.ts` planted (before the matcher fixes) | flagged ✓ |
| removed | clean ✓ |
| `src/lib/__probe2.ts` planted (after the matcher fixes and the allowlist) | **`Unreachable modules: 1`, exit 1** ✓ |
| removed | **`Unreachable modules: 0`, exit 0** ✓ |

The second run matters more than the first: it proves the allowlist did not turn the gate into
something that passes unconditionally, which is the way a gate most commonly dies.

## The self-test earned its place

Seven self-tests run inside the audit; it exits 3 and calls its own result untrustworthy if any
fail.

One of them fired for real during this build. After `scripts/` was added to the referrer set, the
audit began scanning **itself** — its allowlist holds module paths as string literals, so every
module in the list looked referenced. `budgetVarianceAlignment` silently dropped off, and the
planted-orphan test started passing when it should have failed.

Nothing else would have caught that. The violation count went *down*, which reads as an
improvement.

## What is NOT verified

- **The gate has never run in CI.** It is wired into `ci.yml` and `npm run check`; the first real
  run is the next push.
- **The three DEBT entries are recorded, not fixed.** `emit.ts` and its two readers, `EmptyState`,
  `fetchJson` — all still unused, now with their status on the record.
- **`npm run check` was not run end to end** — its components were each run by name, and it also
  includes `npm run tbc`, which cannot pass until this build's own docs are written.
