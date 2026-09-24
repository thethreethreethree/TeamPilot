# BUILD — say the units, guard the units, defer the rename

Nothing on screen changes. This build exists because the next change to touch `closeRate` would
otherwise have a 50% chance of being wrong by 100x, silently.

### Both definitions state their units and name the other one

- **write-path:** doc-comments on `RepRow.closeRate` (`teamAssessment.ts:226`) and
  `ActivityKpis.closeRate` (`aggregate.ts:299`).
- **read-path:** they are comments, so the gate below is what actually holds them.

Each says what it carries — percentage vs ratio — and points at the sibling with the same name and
the other unit. Reading either one now tells you there are two.

### A drift-guard that fails when either side is "normalised"

- **write-path:** `closeRate carries two units on one payload, on purpose` in
  `readTeamAssessment.test.ts`.
- **read-path:** removing the conversion at `readTeamAssessment.ts:196` fails it by name:

```
$ npx vitest run src/lib/coach/assessment/__tests__/readTeamAssessment.test.ts
     × gives reps a PERCENTAGE and the team a RATIO for the same 1-of-3 close
      Tests  1 failed | 10 passed (11)
exit 1
```

It asserts the rep row is above 1, the team KPI is at or below 1, and that they describe the same
quantity. Pre-multiplying the team value would make `pct()` double-convert; dropping the rep
conversion would make the table render a ratio. Either direction fails.

**It took two attempts to make it honest.** The first had `if (x === null) return`, which passes on
a fixture that produced nothing. The second passed `outcome` to the `pitch()` helper, which does
not accept it — **vitest went green and `npm run typecheck` did not**, returning `CHECK_EXIT=2`. So
the test was green about a fixture the compiler rejected. `sold` and `presentations` come from the
daily rollup (`daily(rep, doors, sold, noAnswer)`), and `readTeamAssessment.ts:177` derives
presentations as `doors - noAnswer` — so the fixture is now `daily("rep-1", 40, 1, 37)`: three
presentations, one sold, a close rate of exactly one third.

Fourth test today that was green about nothing. The twelve-step gate caught this one; a faster
"just run vitest" would not have.

### The capture that produced the phantom now carries real units

- **write-path:** `closeRate: 12.9` in `src/test/captures/coachAssessment.capture.tsx`, plus a
  rep-selected capture of the Coach Assessment detail path.
- **read-path:** `npm run visual -- coachAssessment` — four images; the Reps table reads `12.9%`.

The fixture that rendered `0.129%` is corrected in place with a comment saying what it was and what
it nearly caused, because the next person to open that file should not repeat it.

The rep-detail capture is new and was the point of the exercise: the Overview / Recordings tab strip
was built on 2026-09-22 and had only ever been verified by string assertions.

### The rename, deliberately not shipped

- **write-path:** none — `RepRow.closeRate` keeps its name.
- **read-path:** the deferral itself is the assertion, recorded in three places so it cannot
  quietly become never: here, `remediate.md`, and `docs/DEMO-READINESS-2026-09-24.md` §6.

`RepRow.closeRate` → `closeRatePct` removes the trap and the compiler finds all 19 references.

It changes a **wire key**. The server would send the new name; a browser on the previous bundle
reads `closeRate`, gets `undefined`, renders `undefined%`. Deferred to after the investor demo, on
the record in `docs/DEMO-READINESS-2026-09-24.md` §6 and in remediate.md — not abandoned.
