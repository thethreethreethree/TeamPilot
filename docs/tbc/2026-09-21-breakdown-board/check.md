# CHECK

## Commands run, by the project's own names

| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | clean |
| `npm run theme:audit` | 0 theme-bound leaks |
| `npm run rls:audit` | 0 missing policies |
| `npm run invariant:audit` | **0 violations** |
| `npx vitest run` | **4,691 passed**, 15 skipped, 668 files |
| `npm run build:ci` | **✅ PASSED** |

The aggregator's 17 existing tests were run **first**, before anything was built on it, and
passed unchanged after the type narrowing. That is the evidence the narrowing was behaviour-
neutral rather than the claim that it was.

## Mutation testing

**`readPitchPeriod` (22 tests):**

| Mutation | Result |
|---|---|
| Y1 — include pre-0254 pitches with zero sections | **1 failed** ✓ |
| Y2 — count rejected bonuses as awarded | **1 failed** ✓ |
| Y3 — drop the rep filter | **1 failed** ✓ |
| Y4 — swallow a child read failure | **1 failed** ✓ |
| Y5 — forward an out-of-vocabulary outcome | **2 failed** ✓ |
| Y6 — unbounded limit | **1 failed** ✓ |
| Y7 — elements keyed globally rather than per pitch | **1 failed** ✓ |

**`PitchBreakdown` (16 tests):**

| Mutation | Result |
|---|---|
| Z1 — rank the opportunity by miss rate | **1 failed** ✓ |
| Z2 — lowest section by raw points rather than ratio | **2 failed** ✓ |
| Z3 — a failed load renders as an empty period | **1 failed** ✓ |
| Z4 — drop the exclusion reasons | **1 failed** ✓ |
| Z5 — show a rounding-sized gap as an opportunity | **1 failed** ✓ |
| Z6 — drop the per-element pitch count | **1 failed** ✓ |
| Z7 — drop the reconciliation footer | **1 failed** ✓ |

Z2 is checked against the mockups rather than against my own arithmetic: team Transitions 4.7 is
lower in raw points than Close 8.6, and **Close** is the one badged LOWEST, because 57.3% of 15
beats 58.8% of 8.

## What is NOT verified

- **No browser has rendered the board.** It builds and prerenders; tests are jsdom.
- **No real aggregate exists**, because no real pitch has been scored. Every number on it has come
  from a fixture.
- **"Day" is a rolling 24 hours, not the rep's calendar day.** Stated in the source and carried as
  residual R2 — not a bug found later, a limitation accepted deliberately.

## A flake, named rather than shrugged off

One full-suite run during this build reported `1 failed | 4690 passed` and did not name the test
in the captured output. Four subsequent runs were clean at 4,691.

It is recorded because the alternative — noticing a red run, seeing green on the retry, and
reporting green — is how a real intermittent failure gets absorbed into "it passes now". What is
honestly known: the failure was not reproduced in four attempts, and the run that produced it was
in the same invocation as an unrelated markdown edit. What is NOT known: which test it was.

If it recurs, the thing to do is capture the name, not the count.
