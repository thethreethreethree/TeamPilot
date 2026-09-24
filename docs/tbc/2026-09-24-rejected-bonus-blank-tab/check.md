# CHECK — what was run, what it proved, and what it cannot prove

## Commands

```
$ npx tsc --noEmit -p tsconfig.json
(no output)
exit 0
```

It printed nothing **before** the fix too, which is the point of the whole build record: a cast
cannot be wrong at compile time, so the compiler had nothing to say either way.

```
$ npm run enum:audit
  CHECK-constrained sets: 106
  Declared mirrors:       11
Every declared mirror matches its CHECK set exactly.
exit 0
```

```
$ npm run check
  Test Files  710 passed | 1 skipped (711)
       Tests  5474 passed | 15 skipped (5489)
CHECK_EXIT=0
```

These are the run's numbers. An earlier draft of this file carried 711/5488 — written while
the gate was still on `lint`, from no output at all. Pulled and replaced rather than left to
look like a reading.

## Mutants, each restored

| Mutation | Result |
|---|---|
| Remove `rejected_bonus` from `MARKER` and the `markerFor` fallback | **8 render tests fail**, not 3 — the legend renders on every detail pane, so one missing entry blanks the tab. The blast-radius claim, demonstrated. |
| Remove `rejected_bonus` from `EVENT_TYPES` | `enum:audit` fails with `MISSING: rejected_bonus`. |
| Write a hardcoded `"uploading"` in the door-log backoff branch | `writes 'recorded' back, rather than a status it was never at` fails by name. |

## The sweep (A26)

**The class:** *a cast that narrows a database column to fewer values than its CHECK or enum
allows.*

**The boundary searched:** every single-line `as "a" | "b"` in `src/`, excluding tests — 20 sites.
Each verified against the column's constraint across the whole migration history, not just the
`CREATE TABLE`, because the bug that started this was introduced by an `ALTER` in 0254 widening a
CHECK written in 0252.

| Outcome | Count | Sites |
|---|---|---|
| Matches its constraint exactly | 9 | `coaching_sessions.context` ×3, `coaching_sessions.status`, `patterns.item_kind` ×2, `profiles.status`, `care_knowledge_docs.status`, agent presence status |
| Not a database column — a computed ternary or a form input | 6 | `care/demo/ask:80`, `patterns/event:145`, `label-transcript:155`, `finance/tax/page:162`, `JeffLiveChat:56`, `SalesRoleplay:49` |
| A query parameter, not a column — a **different** class | 3 | `coach-assessment/dashboard:41`, `pitch-score/breakdown:42`, `files/route:53` |
| **Real instance** | 1 | `doorlog/worker.ts:284` |
| Fixed by this build | 1 | `readRecordings.ts:214` |

### The instance found

class: a cast that narrows a database column to fewer values than its CHECK or ENUM TYPE allows
sweep: `grep -rnE 'as "[a-z_]+"( *\| *"[a-z_]+")+' src --include=*.ts --include=*.tsx | grep -v __tests__`
severity: low

`worker.ts:284` cast `pitch.status` to `"uploading" | "transcribing" | "analyzing"`. But
`claimPitchesToProcess` (`src/lib/data/doorlog.ts:328`) selects
`.in("status", ["uploading", "recorded", "transcribing", "analyzing"])` — **four** values — and
`setPitchStatus` typed its parameter as five of the enum's six, also omitting `recorded`.

**[OBSERVED]** the cast excludes a value that reaches it.
**[OBSERVED]** nothing currently breaks: the value is passed straight back to the column, and
`recorded` is legal there. The branch's stated intent — *"Keep the current status so it resumes
there"* — is served correctly, by accident of the cast being erased at runtime.
**[INFERRED]** it is the same shape one step earlier in its life. `MomentKind` was also harmless
until something switched on it.

Fixed at the row type rather than at the call site, so every consumer inherits the truth instead of
each one asserting its own.

### What the sweep does NOT cover

class: the same narrowing expressed in a form the literal search cannot see — a named type alias, a multi-line union, or a `switch` with no `default` over a column the schema has since widened
sweep: not run; the forms above are not greppable without reading each site, and no command is offered here rather than a command that would look like coverage
severity: medium

The search was literal single-line quoted unions. It would miss a narrowing written as a named type
alias (`as PitchStatus` where that alias is itself too narrow), one split across lines, or a
`switch` with no `default` over a column the schema has since widened. **[ASSUMED]** those are rarer;
not verified. Recorded as residual R2 rather than implied clean.

## What this build CANNOT prove

**A test cannot guard a cast.** Casts are erased at compile time, so re-introducing
`as "bonus" | "violation"` at `readRecordings.ts:214` would not fail a single one of the 5,400
tests — the runtime behaviour is identical. What guards it is `enum:audit`, and only because the
union is now *declared* as a mirror. The door-log fix has no equivalent gate: `pitch_status` is a
Postgres `ENUM TYPE`, not a CHECK, and `enum:audit` parses CHECKs. That gap is residual R1.

**Nothing here proves the panel looks right to a manager.** It was rendered and opened, and the
grey "Considered" row was read off the screen rather than inferred — but that is one fixture in one
theme at one width, captured by me, not the product running against a real database.
