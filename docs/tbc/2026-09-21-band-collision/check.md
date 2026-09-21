# CHECK

## Commands run, by the project's own names

| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | clean |
| `npm run invariant:audit` | **0 violations** |
| `npm run reachability:audit` | **0 unreachable** |
| `npx vitest run` | **4,696 passed**, 15 skipped |

## The collision was confirmed against the code, not inferred

Three things were read rather than assumed:

1. `gamification/bands.ts` in full — five bands, their boundaries, their labels, and the docblock
   claiming sole-source status.
2. `arenaSummary.ts` — confirms the Arena consumes `bandFor` and `BAND_LABEL` from that file, so
   the collision is with something live rather than something merely present.
3. `my-progress/page.tsx` — confirms both components render on one page, which is what turns a
   duplicated table into a visible contradiction.

## The guard, measured

| | Result |
|---|---|
| four-band copy reinstated | **3 failed**, 22 passed |
| restored | **25 passed** |
| the same copy, before this build's tests existed | **0 failed** |

That last row is the finding. Two passing tests on a function that disagreed with the rest of the
product at both ends of its range.

## What is NOT verified

- **No browser has shown either label.** The change is to a string a component renders; the
  components are jsdom-tested only.
- **No stored pitch has a band yet**, so nothing in the database carries the old four-band
  wording. Had any existed, they would need re-banding — worth stating because the next
  equivalent change will not be free.
- **Only the bands were checked.** The technique that found this — ask whether the product
  already prints each number the new system prints — has been applied to exactly one number.
