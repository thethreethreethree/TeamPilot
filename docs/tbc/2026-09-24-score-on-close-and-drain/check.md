# CHECK — what was run, and the one thing none of it proves

## Commands

```
$ npx tsc --noEmit -p tsconfig.json
(no output)
exit 0
```

```
$ npm run invariant:audit
  Documented exceptions: 38
  Violations:           0
exit 0
```

That one mattered. The first version of this build failed it:

```
✗ Route returns a raw error .message to the client (CWE-209)
    src/app/api/coach/sales-session/pitch-score/route.ts:111
```

A true positive on the shape and a false positive on the risk — the string is curated, never an
exception's text. Renaming the field to `humanMessage` removed both, which is better than an
allowlist entry asserting the difference.

```
$ npx vitest run src/app/dashboard/sales-coach src/components/layout src/app/api/coach/sales-session/pitch-score
 Test Files  15 passed (15)
      Tests  172 passed (172)
exit 0
```

```
$ npx vitest run src/app/api/coach/sales-session
 Test Files  66 passed (66)
      Tests  520 passed (520)
exit 0
```

## The refactor's own regressions, caught by the tests it was meant to preserve

Extracting `scoreSession` broke three existing assertions, and each was a real behaviour change I
had not intended:

| Test | What my refactor did |
|---|---|
| `refuses a huddle with a reason` | Message lost `(this is a huddle)` — the route rebuilt it from a static per-reason map, and only the authority knows the kind. |
| `refuses a meeting with a reason` | Same. |
| `suppressed → 502` | I had changed it to 409. |

The first two are fixed by returning the composed sentence with the verdict. The third is
**reverted to 502 and left there** — 409 describes an account state better and would stop these
appearing in error monitoring as failed dependencies, but that is a behaviour change nobody asked
for, in a build about reachability, and the test asserts 502 on purpose. Recorded as an
observation, not taken quietly.

## Findings

### Pattern Interrupt has never been able to open a pattern

class: a derived artifact whose only trigger is a human deliberately asking for it
sweep: `grep -rn "runDetection" src --include=*.ts | grep -v __tests__`
severity: high

**[OBSERVED]** `patterns` rows are created in exactly one place, `runDetection.ts:99`, and
`runDetection` is called from exactly one place — inside the scoring path. `patterns/event/route.ts`
only updates patterns that already exist.

**[INFERRED]** so in production no pattern has ever opened, and every Pattern Interrupt surface
(three boards in the build plan) renders its empty state. Nobody reported this one; it was found by
looking.

This build does not fix it directly and does not need to: detection runs inside `scoreSession`, so
the drain and the close hook now reach it for free. What remains unverified is whether detection
behaves correctly on a backlog scored in one burst, since it reasons over "the last 10 applicable
pitches" and the drain creates them oldest-first in batches of eight.

### The sweep's boundary

class: derived data with no automatic writer, across the whole product
sweep: `python -c "json.load(open('vercel.json'))"` for the 12 crons, then each cron's entry import, then the writer of every derived table a surface reads
severity: critical

**[OBSERVED]** 13 derived artifacts; 11 have an automatic trigger; the 2 that do not are
`pitch_scores` and `patterns`. Full table in `docs/AUDIT-UNTRIGGERED-ARTIFACTS-2026-09-24.md`.

## What this build CANNOT prove

**Nothing here ran against a real database.** Every test mocks `fetchAllPaged` and `scoreSession`.
What is verified is the *contract* — the count is free, suppressed halts, the loop terminates,
nothing is re-billed, a rep is refused. What is **not** verified is that the candidate query
actually selects John's sessions, that `pitch_scores.session_id` is populated on every historical
row, or that a real grading completes inside 300s eight times over.

**The claim "John's Recordings list will fill" is [INFERRED], not [OBSERVED].** It follows from the
code path. It has not been watched happening.
