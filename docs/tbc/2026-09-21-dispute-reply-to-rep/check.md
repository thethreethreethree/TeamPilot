# CHECK

## Commands run, by the project's own names

| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | clean |
| `npm run theme:audit` | 0 theme-bound leaks |
| `npm run rls:audit` | 0 missing policies, 0 tenant-pin risks |
| `npm run invariant:audit` | **0 violations** |
| `npx vitest run` | **4,653 passed**, 15 skipped, 666 files |
| `npm run build:ci` | **✅ PASSED** |

## Mutation testing

**Rep-side rendering (27 tests in the file, 6 new):**

| Mutation | Result |
|---|---|
| W1 — hide the waiting state (dispute shown with no status) | **4 failed** ✓ |
| W2 — never show the reply | **1 failed** ✓ |
| W3 — drop the "score stays as it is" reassurance | **2 failed** ✓ |
| W4 — hide the whole section | **5 failed** ✓ |

**Rep-side read (14 tests, 4 new):**

| Mutation | Result |
|---|---|
| X1 — hand the replay disputes before answers (ordering) | **1 failed** ✓ |
| X2 — drop `includeAnswered`, so an answered thread vanishes from the rep's view | **1 failed** ✓ |

X2 is the one worth naming: without it, a rep's dispute would disappear from their screen the
moment a manager replied — the reply arriving and the thread vanishing at the same instant. It
would look exactly like the bug this build exists to fix.

The manager-side suite (17 tests) was re-run unchanged after the extraction. Passing without edit
is the evidence that `replayDisputes` came out behaviour-identical.

## The cross-side agreement is a test, not a comment

`readPitchScore.test.ts` asserts the rep's view calls a re-filed dispute **open** — the same case
the manager's suite asserts. That is the term a second, local implementation would drop, and it is
the one whose failure would be silent: the queue saying handled while the rep's screen says
waiting, with no error anywhere and a person on each end of the disagreement.

## What is NOT verified

- **No browser has rendered any of it.** Builds and prerenders; tests are jsdom.
- **No real dispute has ever been filed**, because no real pitch has been scored. The loop is
  closed in code and has never been walked by two people.
- **Nothing notifies anyone.** Both sides are pull surfaces. The manager learns of a dispute by
  opening Coach Assessment; the rep learns of a reply by re-opening the pitch.
