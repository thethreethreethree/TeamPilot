# CHECK — a capability with a read, two writers, and no door

## The canonical gate

```
$ MIGRATION_AUDIT_PSQL="docker exec -i ics-postgres psql -U ics" MIGRATION_AUDIT_MAINT_DB=ics npm run check
$ echo "CHECK_EXIT=$?"
CHECK_EXIT=0
```

## The test that decides whether this build is finished

`src/lib/files/__tests__/autoRoute.rule3.test.ts` — five cases, and the first one is the point:

```
THE LOOP CLOSES — a file routes to the department its uploader is in
  → departmentIds contains "d-sales"
  → ruleTrace contains "R3:uploader-dept-fallback=1"
```

R3 had never run. Saving a department assignment and calling the feature done would have passed
layer 2 and failed layer 3: the effect of the control is not on the page it lives on.

The other four: no fire when the uploader is in none (the state since 0055); every department when
they are in several; **R3 stays quiet when an earlier rule already matched** — its guard is
`departmentIds.size === 0` and losing that would file one document in two places; and no fire for
an anonymous upload.

## Route tests — seven cases

| Case | The defect it names |
|---|---|
| adds only what is new, removes only what is gone | a replace-all rewriting `assigned_by` on unchanged rows |
| writes nothing when the set is unchanged | the same, for a no-op save |
| removes the ones dropped | a one-directional diff |
| a failed read refuses to diff | `[]` meaning "in no department" — and `profile_departments` is `primary key (profile_id, department_id)`, so re-inserting an existing row is a KEY VIOLATION, not a duplicate |
| a partial save answers 500 **and the set that holds** | the page showing the request rather than the truth |
| success answers the read-back set | echoing the request back |
| a foreign member is 404 before any write | an RLS refusal standing in for "not found" |

## Mutation probes — run, not reasoned about

| Mutant | Result |
|---|---|
| R3's `departmentIds.size === 0` guard removed | `is a FALLBACK` fails |
| R3's `departmentIds.add` neutered | `THE LOOP CLOSES` and the multi-department case fail |
| `listProfileDepartments` null coalesced to `[]` | `refuses to compute a diff it cannot compute` fails |
| `toAdd` made a replace-all | both diff cases fail |

## A bug in my own fixtures, twice, and what it cost

1. **The fallback case tested nothing.** R2 reads the task with `.maybeSingle()`; the mock always
   answered `null`, so R2 never matched, `departmentIds` stayed empty and R3 fired — which the test
   reported as R3 ignoring its own guard. The fixture could not reach the state it described. Split
   into `TABLE_ROWS` and `SINGLE_ROWS`.
2. **Six route tests returned 400.** The member id was `11111111-1111-1111-1111-111111111111`,
   which LOOKS like a uuid and is rejected by zod — the variant nibble must be 8, 9, a or b. The
   failure read as a broken handler.

Third and fourth fixture bugs of the session, after the `?? 42` that overwrote an explicit null and
the matcher that passed for the wrong reason. All four shared one shape: **the fixture was wrong and
the failure pointed at the code.**

## What this run does not cover

- **No database.** The RLS policies that are the actual authority here are asserted by reading them,
  not by running as a non-admin. The 0265 build has a behavioural probe of the same policies.
- **No browser.** The picker is a `<details>` with checkboxes; jsdom would assert its text and say
  nothing about whether it opens where a manager expects.
- **The end-to-end claim** — assign a department in the UI, upload a file, watch it route — is three
  layers in one gesture and is not automated anywhere.

---

## Findings

### Four fixture bugs in one session, all with the same shape

class: a test fixture that cannot reach the state its name describes, failing in a way that points
  at the code. Not flakiness and not a typo — a setup whose defect is invisible because the test
  DOES fail, convincingly, about the wrong thing.
severity: medium — none reached production, and all four cost time that looked like debugging.
sweep: no mechanical sweep exists. The tell is a failure whose message does not match the thing the
  test is named for: "R3 ignored its guard" when the guard was never reached, "expected 200, got
  400" when the handler was never entered. The habit is to re-read the fixture before the code when
  a failure is surprising.

Today's four, in order:

1. `timestamp_s: over.timestamp_s ?? 42` — `??` overwrote an explicit `null`, so the untimed-flag
   case tested the timed one.
2. A matcher asserting no `.in("id", …)` anywhere, which passed because `fetchUploaderNames` issues
   its own against `profiles` — right answer, wrong reason.
3. R2's `.maybeSingle()` always answering `null`, so the fallback case could not set up the state
   it was testing.
4. `11111111-1111-1111-1111-111111111111` — rejected by zod, six tests 400, read as a broken route.

What they share: **the fixture was wrong and the failure accused the code.** Three of the four were
caught only because the failure message was strange enough to re-read the setup. The fourth (2) was
caught by mutation-probing a test that had reported success.

The structural defence is the one already in use — probe the test by breaking the code and watching
the RIGHT case fail. A test reporting success is not evidence; a test that fails for the stated reason is.
