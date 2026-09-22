# CHECK

```
$ MIGRATION_AUDIT_PSQL="docker exec -i ics-postgres psql -U ics" MIGRATION_AUDIT_MAINT_DB=ics npm run check

  ✓ typecheck  ✓ lint  ✓ theme:audit  ✓ rls:audit  ✓ invariant:audit
  ✓ reachability:audit  ✓ migration:audit (256 migrations, real Postgres 16)
  ✓ tbc:docs  ✓ tbc:manifest  ✓ tbc:artifacts  ✓ tbc:residual  ✓ tbc:freshness

  Test Files  681 passed | 1 skipped (682)
       Tests  5023 passed | 15 skipped (5038)

exit code: 0
```

Three of those nine stopped this build and each one was right to.

## Mutation runs

Twenty-nine mutants across the four pure modules. The final run, after the Missed-opens/Hit-clears
ruling:

```
$ python scratchpad/mutpat2.py          $ python scratchpad/mutrun.py
CAUGHT  S1  improving is CLOSED (C8)    CAUGHT  R1 drop ignoreDuplicates
CAUGHT  S2  drop at-least-one-clean     CAUGHT  R2 wrong conflict key
CAUGHT  S13 clean means not-missed      CAUGHT  R3 report offered, not accepted
CAUGHT  S3  drop the two-window guard   CAUGHT  R4 throw on a write failure
CAUGHT  S4  drop the rate test          CAUGHT  R5 drop the rep id from the log
CAUGHT  S5  compare last-5 to last-5    CAUGHT  R6 detect non-elements too
CAUGHT  S6  same rate is improvement    CAUGHT  R7 ignore the miss predicate
CAUGHT  S7  stalled ignores the streak  CAUGHT  R8 do not freeze the strip
CAUGHT  S8  stalled a day early
CAUGHT  S9  uncoached falls through     CAUGHT  D1 threshold 3 -> 2
CAUGHT  S10 fix ignores the streak      CAUGHT  D2 do not cap at the window
CAUGHT  S11 openNotImproving counts     CAUGHT  D3 sort oldest-first
CAUGHT  S12 do not sort the input       CAUGHT  D4 default counts Partial
                                        CAUGHT  D5 cost over misses
                                        CAUGHT  D6 allow a negative loss
                                        CAUGHT  D7 streak past a non-clean
                                        CAUGHT  D8 clean accepts a partial

SURVIVORS: none
exit code: 0
```

**S2 survived the first run and is caught in this one, and nothing about the tests changed to make
that happen.** Under one shared predicate the term was mathematically dead — proved by exhaustion,
not by argument. The founder's ruling separated the predicates and it became the only line between
"the miss rate fell" and "they are actually landing it". Two mutants were added because of it: S13
(revert `clean` to not-missed) and D8 (let `doneRight` accept a Partial), so the ruling cannot be
undone by accident.

R5 also survived its first run. It is not a leak — nothing reaches the client either way — but it
strips the rep and company id from the only trace a failure on this path leaves, because detection
runs after the request has effectively returned 200.

---

## Findings

### The boards had never been looked at, and four things built from inference were wrong

class: reconstructing a specification from adjacent sources — a deferral note, a contradictions
  record — instead of from the specification, which was in the tree the whole time. §5's
  confident-answer-too-quickly, at the point where it is hardest to notice because every source
  cited is real.
severity: high
sweep: `docs/SYSTEM UPDATES AND REVISION 09-22-2026/EVIDENCE.md` — all 11 sources re-opened
  first-hand; `git diff` of `0258`, `status.ts` and `SalesCoachShell.tsx` shows what each one
  changed.
- The two JPEGs **opened**, after twenty-two builds carrying "cannot be displayed" as a residual.
  Nobody had tried since the first failure.
- `pattern_events` needed six kinds and I had invented five, missing `drill_assigned`,
  `rep_reviewed` and `clip_disputed` — three of which drive markers and a count card already
  drawn on the Rep progress board.
- Improving was "since coaching vs at detection" and the guide says first-5 vs last-5. The board
  prints the guide's two figures in a column headed MISSES THEN → NOW.
- Stalled was missing its "no clean streak" term.
- `first_seen` and `rubric_version` were absent from the table.
- Separately, the rep nav had six items where the board draws three, the Breakdown board had four
  callouts where the board draws one, and Training had been made `repOnly` when the live
  screenshot in the folder shows it as the manager's team brief.

### INVARIANT 28 reported a duplicate table named "if"

class: a regex over SQL that does not exclude comments, where an optional group failing silently
  produces a plausible capture rather than no match.
severity: medium
sweep: `grep -niE "create\s+table\s+if" supabase/migrations/*.sql` — two files describe the
  phrase in prose; `node --check` plus the four new self-tests beside the existing INV28 ones.
- `CREATE_TABLE_RE` makes `if not exists` optional. In prose the phrase often does not end in
  whitespace — 0022 has `` `create table if not exists` above is a `` (backtick follows) and 0258
  wrapped it across two comment lines — so the optional group fails and `if` is captured as the
  table name.
- **Latent since 0022 was written.** One such comment is harmless; the second one in the repo
  makes `if` a duplicate and reds the build, pointing the author at two files that share nothing.
- Fixed by stripping SQL comments before matching, which is precise: a CREATE TABLE inside a
  comment is never a CREATE TABLE. The check keeps full power over real DDL.

### Six write operations on two new tables had no policy and no allowlist entry

class: a deliberate omission that looks identical to a careless one until someone writes down
  which it is.
severity: medium
sweep: `npm run rls:audit` — it named all six.
- Detection runs server-side and every human action is an appended event, so there are genuinely
  no client write policies. The audit was right to refuse it until the reason was on the record:
  each of the six now carries one, and they are specific ("a direct client insert would let a rep
  forge 'coached' and clear their own stalled flag") rather than a shared sentence.

### The detector was complete and reached by nothing

class: A31 — schema-complete is not built. Two tables, a detector and a resolver, all correct,
  all tested, and no route or surface consuming any of it.
severity: high
sweep: `npm run reachability:audit`, which named `status.ts` exactly.
- Caught by the gate at the moment the temptation was strongest: the logic was finished and
  mutation-clean, and committing there would have felt like shipping a feature. The wiring —
  read layer, route, two-column board — is the difference between a correct system and a feature.

### The at-least-one-clean term is redundant under the current reading of "clean"

class: an equivalent mutant, which is a finding about the SPEC rather than about the tests.
severity: low
sweep: `src/lib/coach/patterns/__tests__/statusRedundancy.test.ts`, which walks all 36
  window-pairs rather than arguing.
- With both windows fixed at 5, a fallen rate forces `lastMisses ≤ 4`, so at least one of the
  last five is already not-a-miss. No test can catch the term's removal.
- It stops being redundant under one reading the boards invite: if "clean" means DONE RIGHT (a
  hit) rather than "not missed", five Partials would be a fallen rate with nothing done right.
  The legend reads "Missed / Done right / Not applicable" and PATH TO FIXED reads "Done right in
  5 pitches in a row". That is the same open question as B4 and is **not settled here**.

### A `detected` event would have been rejected by my own CHECK constraint

class: code written from the memory of an earlier draft of a file rather than from the file.
severity: medium
sweep: `grep -n "kind in (" supabase/migrations/0258_pattern_interrupt.sql` against every
  `pattern_events` insert in `src/`.
- The first draft of 0258 had an invented five-kind list including `detected`. The guide's six
  replaced it hours later. `runDetection` was then written to insert a `detected` event — from the
  draft, not from the file that had superseded it.
- The failure would have been near-invisible: detection runs AFTER the score is saved and after a
  200 is effectively decided, so a rejected insert is a log line nobody reads. The patterns would
  have been written correctly and the timeline start marker would silently never exist.
- Resolved by deleting the insert rather than widening the CHECK. The row's `first_seen` IS the
  detection marker — it is what the board prints and what the OPEN column counts from — and all
  six of the guide's kinds are things a human did.

### The at-least-one-clean term came alive

class: a spec finding from an equivalent mutant, resolved by a ruling rather than by code.
severity: low
sweep: the S2 mutant, before and after; `statusRedundancy.test.ts`.
- This morning S2 (deleting the term) SURVIVED and was proved equivalent by exhaustion. After the
  Missed-opens/Hit-clears ruling it is CAUGHT. The test file that proved the redundancy now proves
  the opposite and keeps the old exhaustion argument, so a revert to one shared predicate fails
  loudly instead of quietly re-killing the rule.
- Worth recording as a pattern: a surviving mutant was not a gap in the tests and not noise — it
  was the specification asking for a condition its own other condition implied, and the fix was a
  product decision.
