# CHECK

## Commands run, by the project's own names

```
 Test Files  669 passed | 1 skipped (670)
      Tests  4738 passed | 15 skipped (4753)
VITEST_EXIT=0
```

```
═══ ELOSTATE RLS policy audit ═══
  Migrations scanned:    254
  RLS-enabled tables:    148
  Allowlisted omissions: 189
  Tables without RLS:    0
  Tenant-pin risks:      0
  Missing policies:      0
  RLS-bypassing views:   0
EXIT=0
```

```
═══ Invariant audit — lessons this codebase already paid for ═══
  Files scanned:        1049
  Documented exceptions: 38
  Violations:           0
EXIT=0
```

```
═══ Migration apply audit — the whole history, against real Postgres ═══
  Migrations applied:      254
  Failed on a fresh DB:    0
  Not re-runnable (known): 18
  Not re-runnable (NEW):   0

✓ All 254 migrations apply to a database shaped like production, and no NEW migration is non-re-runnable.
EXIT=0
```

That run includes 0255 and 0256 and was made **in this session**, against a Postgres 16 container
(`MIGRATION_AUDIT_PSQL="docker exec -i ics-postgres psql -U ics"`, `MIGRATION_AUDIT_MAINT_DB=ics`).
It is not the earlier run being quoted back.

| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | clean |
| `npm run theme:audit` | no theme-bound leaks |
| `npm run reachability:audit` | 0 unreachable |
| the three override suites | 56 passed, exit 0 |

## The tests were made to earn their place

Not asserted — mutated. Each defect was re-introduced into the source and the suite re-run.

**The read path** (`readPitchScore`, 6 mutations):

| Mutation | |
|---|---|
| ask the database for oldest first | CAUGHT |
| drop overrides whose item the rubric retired | CAUGHT |
| blank label instead of falling back to the id | CAUGHT |
| label from the id, ignoring the rubric | CAUGHT |
| drop the reason | CAUGHT |
| lose `actorId` | CAUGHT |
| unbounded read (`.limit(5000)`) | CAUGHT |

**The route** (9 mutations):

| Mutation | |
|---|---|
| remove the manager gate | CAUGHT |
| remove the tenant comparison | CAUGHT |
| proceed on unreadable evidence | CAUGHT |
| leak the database message | CAUGHT |
| rate limit after the work | CAUGHT |
| reason not trimmed | CAUGHT |
| missing session tolerated | CAUGHT |
| `companyId` from the body | *equivalent* — see below |
| `actorId` from the body | *equivalent* — see below |

**The recompute** (7 mutations, run earlier in the build): flip `reachedDiscovery`, flip delivery
scaling, trust the caller's old value, use a local band copy, accept an unknown id, accept any
value, report a failed write as success — all CAUGHT.

## The two survivors were run down rather than written off

`companyId`/`actorId` from the body survived. The convenient reading is "the tests are weak". The
actual reason is that `z.object()` **strips unknown keys**, so the field never reaches the handler
and the mutation cannot change behaviour.

That is a claim, so it was tested rather than asserted. The schema was switched to `.passthrough()`
to make the value reachable, and the mutation re-run — with a control:

| | |
|---|---|
| `companyId` from a **reachable** body field | CAUGHT |
| `actorId` from a **reachable** body field | CAUGHT |
| `.passthrough()` alone (control — must SURVIVE) | SURVIVED |

The control is what makes the other two mean anything: if passthrough alone had failed, the two
"catches" would have been the schema change being detected, not the trust. Genuine equivalent
mutants, and the tests do pin who an override is logged against.

## Findings

### F1 — the log was written but nothing could read it

class: a schema-complete feature that is not built (A31). `pitch_score_overrides` existed, the RPC
  wrote to it, the RLS select policy granted the rep — and **no line in `src/` named the table**.
  The migration's own header said "a rep MUST be able to read these — an override they cannot see
  is a silent correction", and the read path had not been written. The feature would have shipped
  as a correction the rep could not see, which is the precise thing it exists to prevent.
severity: high. Not a crash and not visible in any test: every gate except one reported zero violations, the API
  returned 200, and the correction really did move the score. It fails §1.5.4 — the rep-visible log
  is the *specified result*, not layer-4 polish.
sweep: `npm run invariant:audit` — the "finance table must be reachable from the product" rule is
  what caught it. Per-table: `grep -rn "pitch_score_overrides" src/ || echo UNREACHABLE`.
fix: `readPitchScore` now returns `overrides` on every pitch, labelled from the rubric, and the
  five read tests plus seven mutations above cover it.

### F2 — the "newest first" test did not test newest first

class: a mock that swallows the arguments it is handed, making the assertion untestable. The
  override mock accepted `.order()` and ignored what it was asked for, so the rows came back in
  fixture order either way. The test named "keeps the query's newest-first order" would have passed
  against a reader that asked the database for **oldest** first. Found by mutation R1 surviving.
severity: medium. The order is cosmetic on a two-row log and structural on a long one — the newest
  correction is the one that explains the current total, and it would have been at the bottom.
sweep: `grep -rn 'for (const m of \[.*"order"' src/**/__tests__/` — every mock that stubs `.order()`
  or `.limit()` as an identity function is a place where an ordering or bound cannot be tested.
fix: the mock now **records** what was asked for; the test asserts
  `{ col: "created_at", ascending: false }` *and* the resulting array order, and a separate test
  asserts the bound is 100. Both halves are needed: a mapper that preserves order is worthless if
  the query asked for the wrong one.

### F3 — the skip banner hid the reason it was skipping

class: a diagnostic that reports a category instead of a cause, so the reader cannot act on it.
  `migration:audit` printed "SKIPPED — no reachable Postgres" against a **healthy postgres:16
  container**. The real message, swallowed by a bare `catch {}`, was
  `FATAL: role "postgres" does not exist`. Those two situations need completely different actions
  and the banner made them look identical.
severity: medium. It cost three attempts to run a check that was one flag away from working, and
  the failure is self-similar: this script exists *because* a skip that looks like a pass is
  dangerous, and its own skip path had the same defect one level down. It was the second finding
  of this exact shape today — the first was the hard-coded maintenance database (F1 of the
  migration-audit build), fixed in the morning, with the same `catch` still discarding the reason.
sweep: `grep -rn "catch {" scripts/` — roughly thirty sites. Most are benign (optional `.env`
  parsing, JSON-shape probes, teardown). The dangerous subset is narrow: **a bare catch on the path
  that decides whether a gate runs at all**, which is this one. The others were not individually
  audited against that criterion.
fix: `reachable()` became `unreachableReason()`, returning the first error-shaped line from psql's
  stderr, and the banner prints `psql said: …`.

## What is NOT verified

- **No UI yet.** A manager cannot apply an override from the dispute queue — the API exists and is
  tested, the surface does not. The dispute queue therefore still stalls at "reply only", which is
  the §1.5.1 layer-3 gap this build set out to close and has closed only halfway. This is the
  largest open item and it is named in closure.md.
- **The CI run of `migration:audit` has still never happened.** It ran here against a local
  container; the workflow step has not executed.
- **The RPC's own branches have not been executed against Postgres in this session.** The upsert,
  the demote-not-delete path and the tenant raise are covered by reasoning and by the caller's
  tests, not by a SQL-level test.
- **No rep has ever seen an override.** The read path is unit-tested; nothing has rendered it.
