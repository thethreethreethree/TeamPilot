# CHECK

## Commands run, by the project's own names

| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npx eslint src/lib/coach/pitchScore --ext .ts` | exit 0 |
| `npm run lint` (project-wide) | 6 errors, all `no-explicit-any` in the new test — **fixed** by typing the RPC body, then clean |
| `npx vitest run` | **4,497 passed**, 15 skipped, 657 files |
| `npm run theme:audit` | 0 theme-bound leaks |
| `npm run rls:audit` | 0 missing policies, 0 tenant-pin risks, 0 RLS-bypassing views |
| `npm run invariant:audit` | 1,034 files, **0 violations** |

**Not run: `npm run build:ci`.** No UI in this build, but stated rather than implied.

## Mutation testing — do the tests actually discriminate?

The recurring failure in this work has been fixtures too clean to catch the bug. So each of the
five bug shapes was re-introduced into the source and the suite re-run:

| Mutation | Result |
|---|---|
| M1 — bonus events at a fixed face value instead of the verdict | **2 failed** ✓ |
| M2 — `section_points` derived from element rows instead of the verdict | **1 failed** ✓ |
| M3 — duplicate-element guard disabled | **1 failed** ✓ |
| M4 — Objection handling scored even with no objection | **2 failed** ✓ |
| M5 — rejected low-confidence bonuses dropped instead of stored | **2 failed** ✓ |
| restored | 110 passed ✓ |

M1 was re-run after the test file was refactored to remove `any`, since a refactor can silently
neuter an assertion: still 2 failed.

Two tests failed on the first run and **both were the test's fault, not the code's** — a guessed
element id (`deliv.tonality`; the real one is `deliv.tone`) and a mock helper whose `?? "pitch-1"`
default coalesced away the null the test needed. The second is worth naming: that helper would
have made the null-id test pass against any implementation.

## Real Postgres, not assertions

Migrations 0252 → 0253 → 0254 applied in order to a fresh database on **Postgres 16** in Docker.

| Property | Result |
|---|---|
| P1 — exactly one `store_pitch_score` overload after the signature change | `overloads = 1, args = 20` ✓ |
| P2 — INVARIANT 4: not callable by `authenticated` / `anon` | `f` / `f` ✓ |
| P3 — 0254 re-applies cleanly | re-apply OK, still 1 overload ✓ |
| P4 — `section_points` round-trips and sums to `base` | `sections_sum = 62.4`, `base = 62.4` ✓ |
| P4b — `rejected_bonus` stored with its confidence | `confidence = 0.62`, `points = 0.0` ✓ |
| P5 — an invented event type is refused | `violates check constraint "pitch_events_type_check"` ✓ |
| P6 — an evidence-free score is still refused | `a pitch cannot be stored without element grades` ✓ |

P3's output is the one worth reading: on re-apply Postgres reported the old 19-argument signature
*"does not exist, skipping"* — which is the proof that the drop matched the first time rather than
silently missing and leaving a publicly-callable overload behind.

## What is NOT verified

- **Nothing calls `storePitchScore`.** The engine and the writer both exist and neither is wired
  to a route. Residual R2.
- **No real pitch has been scored.** The launch gate from the build guide — *"run 10 to 20 real
  recordings through the scorer and have a manager grade the same pitches by hand"* — has not
  been started and cannot be until a route exists.
- **`bandFor`'s thresholds are inferred**, not specified. Two of the four boundaries have no
  evidence behind them at all. Residual R3.
