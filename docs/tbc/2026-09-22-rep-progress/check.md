# CHECK — Rep progress

## The canonical gate

```
$ npm run check
```

`typecheck && lint && theme:audit && rls:audit && invariant:audit && reachability:audit &&
migration:audit && tbc && test`

Exit code read on its own line, never off a pipeline tail (A38).

| Run | Result | What it caught |
|---|---|---|
| 1 (partial) | lint failure | `<a>` to an internal route — must be `next/link` |
| 2 | see closure.md | — |

`reachability:audit`: **1076 files scanned, 0 violations.** `repProgress.ts` and
`RepProgressBoard.tsx` are both reached, because the surface shipped with the derivation rather
than behind it.

**No migration in this build**, so `migration:audit` has nothing new to judge. It was run
separately against real Postgres earlier the same day and reported *259 applied, 0 failed on a
fresh DB, 0 not re-runnable* — and note that the in-gate run **SKIPS** without
`MIGRATION_AUDIT_PSQL` set and says so in words that are easy to read as a pass. It is not one.

## Mutation testing

17 mutants against `repProgress.ts`. Each is a change a careless future edit could plausibly make;
a survivor is a finding until proven equivalent.

| # | Mutation | Outcome |
|---|---|---|
| 1 | `avgDaysToFix` empty → `0` | caught ×3 |
| 2 | points recovered counts all patterns, not fixed | caught |
| 3 | awaiting-review counts uncoached patterns | caught |
| 4 | "across N reps" counts every rep, not those with an open pattern | caught |
| 5 | `reviewable` = all patterns instead of coached ones | caught ×2 |
| 6 | rep list's third number uses `open` not `openNotImproving` | caught |
| 7 | `clippedStart` always false | caught |
| 8 | out-of-window markers clamped instead of dropped | caught |
| 9 | every event kind drawn as a marker | caught |
| 10 | zero-width window not guarded | caught |
| 11 | `fixedInstant` ignores the `fixed` event | caught |
| 12 | attention order: follow-up above needs-1:1 | caught |
| 13 | overdue `>=` → `>` | **survived → 4 tests added** |
| 14 | agenda de-duplication removed | caught |
| 15 | agenda `slice(0, max)` removed | **survived → test added** |
| 16 | `fixedThisMonth` drops the year check | **survived → test added** |
| 17 | `daysToFix` allows a negative span | **survived → test added** |
| 13b–17b | all four re-run after the new tests | all caught |

### What the four survivors were

**13 — the seven-day boundary.** Every fixture sat well past the line, so loosening `>=` to `>`
changed nothing observable. The board's own alert reads *"has been open 7 days without
coaching"*, so seven is inside. An off-by-one here silently grants every pattern an extra day of
grace before a manager is told. Four tests: exactly-seven and exactly-six, for the pill **and**
for the alert box — they hold separate copies of the comparison, so one test would have left the
other free to drift.

**15 — the three-item cap.** Every fixture happened to have exactly three patterns. A rep with six
open patterns would have been handed a check-in agenda nobody could run in a check-in. The new
test also pins that the three kept are the most urgent, not the first three encountered.

**16 — the year.** Dropping `getUTCFullYear()` survived because every fixture was in 2026. "FIXED
THIS MONTH 6" quietly including last September is a number a manager would never think to doubt.

**17 — a negative span.** Not equivalent, and worth keeping rather than deleting: `first_seen` is
written by the detector and a `fixed` event's `created_at` by whichever server appended it. A few
seconds of skew is ordinary. Either produces "avg −0.1 days to fix", which is not a slightly-wrong
number but a nonsense one on a dashboard.

Contrast with the equivalent mutant deleted from `shareState` earlier today: that one **could not**
affect any output and the code went. This one can, so it got a test. The distinction is the whole
discipline — an inert guard is a lie to the next reader; a live one that nothing exercises is a
gap.

## Two crashes the tests found before a user did

**1. `undefined.filter` through `useMemo`.** A fixture without `events` took the entire Rep
progress tab down. The fix is not "fix the fixture": that fixture **is** a valid response shape,
because a browser holds its JS bundle across a deploy and a client compiled against today's fields
can be handed yesterday's JSON. `events` and `comparison` are both new today. Hardened at every
reader with the reason recorded inline.

**2. `comparison === null` vs `undefined`.** The same class one layer up — a strict null check
turned a missing field into a crash instead of a dash. Now falsy.

Neither would have been caught by typecheck, by lint, or by any audit: both are about a value the
type system was promised and the network did not deliver.

## Tests

| Suite | Count |
|---|---|
| `repProgress.test.ts` | 42 |
| `RepProgressBoard.render.test.tsx` | 18 |
| `PatternInterrupt.render.test.tsx` | 21 (2 rewritten, 1 added) |
| **new this build** | **62** |

The two rewritten `PatternInterrupt` tests are worth naming. One asserted *"says Rep progress is
unbuilt rather than faking it"* — a test whose whole content was that a feature did not exist. It
now asserts the board renders, and a **new** sibling asserts the rep-scoped case still refuses to
draw a one-person team. The unbuilt-message test was not deleted so much as replaced by the two
facts it was standing in for.

## Not opened

No image, icon or graphic asset was created, edited, moved or restyled during verification.
