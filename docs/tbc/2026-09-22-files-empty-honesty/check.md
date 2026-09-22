# CHECK — "No files attached yet" is three different sentences

## The canonical gate

```
$ MIGRATION_AUDIT_PSQL="docker exec -i ics-postgres psql -U ics" MIGRATION_AUDIT_MAINT_DB=ics npm run check
$ echo "CHECK_EXIT=$?"
CHECK_EXIT=0
```

ELEVEN steps at the time of this run — I wrote "twelve" here and in four other build records, over a list of eleven, all session. Corrected 2026-09-22 when adding `sql:harness` made it twelve for real; a number that becomes true later was still wrong when written. `typecheck && lint && theme:audit && rls:audit && invariant:audit &&
reachability:audit && writer:audit && enum:audit && migration:audit && tbc && test`. Output
redirected to a file and the exit code read on the next line, never through a pipeline.

## The tests, and what each one would have caught

`src/lib/data/__tests__/listFiles.filterBeforeLimit.test.ts` — 7 cases:

| Case | The defect it names |
|---|---|
| inner-joins the join table in the files query | **the bug** — a filter applied behind a LIMIT |
| does it in ONE request, no pre-read | the id-list cap that the first draft needed |
| composes several filters as an AND | losing the AND the JS chain had |
| no m2m filter → no `!inner` at all | an unconditional inner join dropping every unfiled file |
| files query fails → `null` | the swallow that made the page's error branch unreachable |
| successful read of nothing → `[]` | over-correcting, so `null` starts meaning "empty" |
| a filter matching nothing → `[]`, not `null` | "couldn't load" shown for a genuinely empty task |

`src/components/files/__tests__/TaskAssetsSection.errorHonesty.render.test.tsx` — 4 cases: the
error line instead of the empty state, the Retry, the genuine-empty case still saying "No files
attached yet", and the success case.

## Mutation probes — run, not reasoned about

**Making the joins outer** (`!inner(task_id)` → `(task_id)`) and, separately, **dropping the
`.eq()` on the embedded column** — two different ways to break the same guarantee:

```
FAIL  … > inner-joins the join table in the files query itself
FAIL  … > composes several filters as an AND
      Tests  2 failed | 5 passed (7)
```

Identical failures from both mutants, which is correct: an outer join and a missing filter both
leave the narrowing to happen somewhere other than the query.

**Removing the panel's failure branch** (`else { setLoadError(true); }`):

```
FAIL  … > says the read failed instead of 'No files attached yet'
FAIL  … > offers a retry, because a transient failure should not need a page reload
      Tests  2 failed | 2 passed (4)
```

Two each. On the panel that is two separate claims — the message and the recovery. On the query
it is the same claim reached two ways, which is why both mutants fail the same pair.

**A bug in my own test harness, caught by the first run.** The "no m2m filter" case asserted that
no `.in("id", …)` was issued *anywhere*, and passed for the wrong reason — `fetchUploaderNames`
issues its own `.in("id", uploaderIds)` against `profiles`. Scoped the matcher to calls on the
`files` table. An assertion that passes for the wrong reason is worse than one that fails.

## What was checked against the database rather than assumed

- **RLS on the join tables**, before designing the filter. All three carry
  `USING (EXISTS (SELECT 1 FROM files WHERE files.id = <join>.file_id))`, and that nested select
  is under `files`' own RLS. The join narrows; it cannot widen. [OBSERVED]
- **The indexes the join uses**: `file_tasks_task_idx btree (task_id)`,
  `file_departments_dept_idx btree (department_id)`, `file_tags_company_lookup_idx btree (tag)`.
  All three exist. [OBSERVED]

---

## Findings

### The class this build closes had already been swept once, and these three sites survived it

class: a failed read returned as an empty collection — "an error dressed as no-data". A26 names
  this exact class among the ones it was captured from, and `errorHonesty.render.test.tsx` on the
  Sales-Coach Team page is a fix from the 2026-08-18 founder-directed sweep of it. INVARIANT 22
  polices data-layer **catch** blocks that swallow into a value; all three survivors are
  `if (error) return []`, which is not a catch, so the detector cannot see them.
severity: medium
sweep: `grep -rn "if (error[^)]*) return \[\];" src --include=*.ts --include=*.tsx` — three sites,
  and that is the whole codebase. Every other failable read in the project already returns `null`.

- `src/lib/data/files.ts:294` — fixed here.
- `src/lib/data/departments.ts:139` (`listProfileDepartments`) — fixed here.
- `src/lib/data/departments.ts:55` (`listDepartments`) — **deliberately not changed**, and now
  says so. It feeds a filter dropdown; an empty dropdown on failure is a degraded control rather
  than a false claim. That was already the judgement — the files page's comment says it — but it
  was being made by a line indistinguishable from the two that were wrong.
- What the sweep did NOT find: any `catch { return [] }`, because INVARIANT 22 already gates
  those. The two detectors together now cover the class; neither does alone.

## What this run does not cover

- **No browser.** jsdom again.
- **No live database.** The embed syntax is asserted against a mock of the query builder, not
  against PostgREST, so a malformed embed string would fail at runtime while the whole suite still reported success — the
  same gap as 0264's view.

  Mitigated by precedent rather than by a test: this codebase already shipped the identical
  construction. `readReviewFlags`, until 0264 replaced it this morning, ran
  `.select("… pitch_scores!inner(id, rep_id, company_id, recorded_at)")` with
  `.eq("pitch_scores.company_id", …)` — an inner-joined embed filtered on its embedded column, in
  production, on the manager dashboard. Evidence, not reassurance, but it is not the first time
  this syntax has been asked to work here.

### A wait budget that only holds when the suite is quiet

class: an async test wait sized against a standalone run rather than against the full gate. Not
  flakiness — a budget measured under the wrong conditions. Second instance today: the two audit
  test files had the same shape this morning and were raised to 30s with the measurement recorded.
severity: low
sweep: no mechanical sweep exists — "chains two fetches before its first assertion" is not
  greppable. The boundary this session is two files, both found by a full-gate run failing where a
  standalone run passes. `npx vitest run <file>` versus the file's result inside `npm run check`
  is the comparison that finds them.

- `RecordingsTab.render.test.tsx > offers to ASK when nobody has been asked` failed inside the
  gate — `Unable to find role="button" and name /Save as team example/i`, with the DOM showing the
  list rendered and the detail pane still empty. It took **1061ms** against Testing Library's
  1000ms default.
- Standalone, the whole file runs in **1.97s** and all 15 cases pass. Every assertion in it waits
  on two sequential fetches: the recordings list, then the detail for the auto-selected row.
- Raised to `configure({ asyncUtilTimeout: 4000 })` in that file, under vitest's own 5s per-test
  timeout so a genuinely hung render still fails as a timeout rather than taking four seconds
  longer in silence.
- **Not fixed globally, deliberately.** A `setupFiles` entry setting this for all 706 files is the
  structural answer and it changes the environment of every test in the repo; that deserves its
  own build with a before/after measurement, not a line added to this one.

### The same class again, one gate run later — and this time it earned the structural fix

class: as above, a time budget measured on a quiet machine. **Third instance in one day.**
severity: medium — raised from low, because three in a day is a rate, not a coincidence.
sweep: `npm run check` twice. A test that passes standalone and dies inside the gate is the whole
  population, and there is no static way to find them — only the two runs, compared.

- `envDocsComplete.test.ts` — **"Test timed out in 5000ms"**, vitest's own per-test budget this
  time, not Testing Library's. It walks the source tree with regexes and took **7404ms** inside
  the gate. It passes standalone.
- With this, the day's tally is three: the two audit suites this morning (each spawning a node
  process, 0.31–0.42s standalone, raised to 30s), `RecordingsTab` at 1061ms against a 1000ms
  async wait, and this one at 7404ms against 5000ms.
- **None of them is slow.** The suite's own numbers say why: ~102s wall, `transform 160.75s`,
  `import 529.82s`, `tests 187.13s` — the totals across the pool exceed the wall clock several
  times over, so an individual test's elapsed time is mostly other tests.
- Fixed globally in `vitest.config.ts`: `testTimeout: 20_000`, with the three measurements written
  above the line. One config value, no behaviour change, no import added to any test.
- **I declined the global fix an hour ago** in this build's own remediate.md, on the grounds that
  it changes every test's environment. That reasoning applied to a `setupFiles` entry importing
  Testing Library. It did not apply to a timeout number in the config, and a third instance is the
  evidence that the caution was the wrong call. Recorded rather than quietly reversed.
