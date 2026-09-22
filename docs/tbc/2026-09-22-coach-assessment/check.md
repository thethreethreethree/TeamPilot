# CHECK

```
$ MIGRATION_AUDIT_PSQL="docker exec -i ics-postgres psql -U ics" MIGRATION_AUDIT_MAINT_DB=ics npm run check > gate3.log 2>&1
$ echo "CHECK_EXIT=$?"
CHECK_EXIT=0
```

5100 tests, 686 files. The final run; earlier runs in this build are in the findings.

The `echo` is the point of that second line and not decoration — see the first finding.

```
$ python scratchpad/mutassess.py
CAUGHT  A1  zero instead of null on an empty denominator
CAUGHT  A2  ratios inverted
CAUGHT  A3  lowest by absolute points
CAUGHT  A4  allow a negative gap
CAUGHT  A5  rank by coaching grade
CAUGHT  A6  rank by average score
CAUGHT  A7  unstable rep order
CAUGHT  A8  rate delta as a percentage
CAUGHT  A9  divide by a zero team average
CAUGHT  A10 prize threshold exclusive
CAUGHT  A11 more than three priority cards
CAUGHT  A12 reuse a section across cards
CAUGHT  A13 assign before matching
CAUGHT  A14 claim every card matched
CAUGHT  A15 partial phrase match

SURVIVORS: none
```

A1, A2 and A8 were later deleted along with their subject — see the third finding.

The read layer, eight mutants:

```
$ python scratchpad/mutread.py
CAUGHT   T1 team aggregates ALL pitches, breaking sum-to-rows
CAUGHT   T2 absorb the unattributed pitch
CAUGHT   T3 drop reps with no scored pitch
CAUGHT   T4 presentations = recorded pitches
CAUGHT   T5 no_answer ignored
SURVIVED T6 empty team on a failed read
CAUGHT   T7 lowest section for an unscored rep
SURVIVED T8 rows unranked

exit code: 0
```

**T6 is equivalent.** The mutation replaced `return null` with `return null as never` — a type
assertion that changes nothing at runtime, so no test could distinguish them. Recorded rather than
chased.

**T8 was a real gap and is now closed.** Dropping `rankReps` from the read changed no test, because
ranking is tested on its own module and this file only ever summed the rows. Order is the first
thing a manager reads and insertion order here is whatever the pitch read happened to return;
`readTeamAssessment.test.ts` now asserts it.

---

## Findings

### I reported "gate passed, exit 0" from the wrong command's exit code

class: reading an exit status from the end of a shell pipeline and attributing it to the command
  at the start. A38 with a different surface: not a scoped substitute, a mis-read verdict.
severity: high
sweep: `grep -rn "PIPESTATUS\|CHECK_EXIT" docs/tbc/*/check.md` and every background invocation in
  this session's transcript. The pattern to avoid is `cmd | tee log | grep …; echo $?`, where the
  reported status belongs to `grep` or to a trailing `echo`.
- The gate was run as `npm run check 2>&1 | tee log | grep …; echo "CHECK_EXIT=${PIPESTATUS[0]}"`.
  The harness notification reported the COMPOUND command's exit code, which is the `echo`'s, and
  is always 0. I read that and told the founder the gate had passed.
- It had not. The log said `CHECK_EXIT=1`, on two real failures: `teamAssessment.ts` reached by
  nothing, and `rep_activity` named nowhere in `src/`. Both were mine and both were A31.
- **Second time in one session.** The earlier one was a stale test count that I noticed and chased;
  this one I did not notice, and it reached the founder as a claim.
- Now: the gate is run with output redirected to a file and `echo "CHECK_EXIT=$?"` on the NEXT
  line, so the echoed value is the gate's own status with no pipeline between them.

### The guide's `rep_activity` already exists as a view, with more columns

class: a specification naming a table the product already has under another name — A21 arriving by
  instruction rather than by accident.
severity: high
sweep: `grep -rn "rep_kpi_daily" --include=*.ts --include=*.sql .` — five call sites plus its
  definition in 0215 and its security_invoker fix in 0216.
- `rep_kpi_daily` is a VIEW over `door_knocks`, `group by (company_id, rep_id, local_date)`,
  returning `doors_knocked`, `sold`, `no_answer`, `go_backs`, `not_interested` and
  `non_decision_maker`. `security_invoker = on` since 0216, so RLS applies as the caller.
- That is the guide's `rep_activity` (rep_id, date, doors_knocked) with four more columns and no
  staleness, because it is a view.
- It took THREE rounds to establish. Round one I knew only `door_knocks` existed and recommended
  reusing it; the founder ruled to build the table. Round two found `tallyKnockOutcomes` — the
  tested authority for what counts as a door, `no_answer` included — and the founder ruled the
  table should cache it. Round three found the view, and the founder ruled to delete the table.
- Each ruling was correct on the information it had. The lesson is not about the rulings: it is
  that I brought a decision to the founder before finishing the search, three times.

### I wrote the duplicate this file's own header warns about

class: §2.2, self-inflicted, twenty minutes after documenting the class.
severity: medium
sweep: `grep -rn "doorToPresentation\|closeRate" src/lib/` — two implementations existed briefly.
- `teamAssessment.ts` opens with a docblock explaining that it deliberately does not re-implement
  `lowestSection` or `bandFor` because a second copy drifts. Below that docblock I wrote
  `activityRates()`, which re-implemented `computeActivityKpis` — including the null-on-empty-
  denominator rule, with nearly the same comment justifying it.
- It also silently re-opened a settled question. `countPresentations` records *"doors_knocked −
  no_answer … the founder's 2026-09-11 definition"* — the guide's page-8 open decision, already
  decided, the other way from what the mockups assume, and kept one argument from being flipped.
  My version had no such notion.
- **It shipped with four tests that all succeeded.** That is the part worth keeping: a duplicate arrives with
  duplicate tests that also succeed, and they make the duplicate look more legitimate rather
  than less. Two suites asserting one rule is two things to update and one that will not be.

### A team average that would not have summed to its rows

class: an aggregate computed over a different set than the rows beneath it.
severity: medium
sweep: the launch checklist's own line — "rep totals sum to team totals for points, doors,
  presentations and sold" — checked against `sumTeamTotals` and the team aggregate's input.
- `AggregablePitch.repId` is optional. The first version grouped attributable pitches into rep
  rows but computed the team aggregate over `read.pitches`, all of them. A pitch with no rep would
  have been in the team average and in no row.
- Typecheck caught the symptom (`string | undefined`), not the cause; the fix was to aggregate the
  team over the same attributed set the rows are built from, and to report `unattributed` rather
  than absorb it.

### I used the ELO badge where the board shows a letter grade

class: two components on one endpoint, differing only in presentation, picked by name rather than
  by what the design draws.
severity: medium
sweep: `grep -rn "AgentEloBadge\|AgentGradeBadge" src/` — the old page switched between them on
  the user's Expert/Standard mode; every other call site is a rep's own view.
- `AgentEloBadge` renders the raw ELO number and a gauge. `AgentGradeBadge` renders the letter.
  The board's column is headed COACHING GRADE and shows "B+ Solid", and its rep detail header
  reads "coaching grade B Provisional" — both the letter.
- **Found by the reachability gate, not by reading the board again.** Deleting the old page left
  `AgentGradeBadge` reached by nothing, and the orphan was the symptom: I had used its sibling in
  the one place that should have used it. A gate about dead code caught a wrong-component bug.
