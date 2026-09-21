# CHECK

## The canonical command

```
$ MIGRATION_AUDIT_PSQL="docker exec -i ics-postgres psql -U ics" MIGRATION_AUDIT_MAINT_DB=ics npm run check

  ✓ tbc:docs        ✓ tbc:manifest     ✓ tbc:artifacts
  ✓ tbc:residual    ✓ tbc:freshness

  Test Files  677 passed | 1 skipped (678)
       Tests  4960 passed | 15 skipped (4975)

exit code: 0
```

All nine of nine — typecheck, lint, theme:audit, rls:audit, invariant:audit, reachability:audit,
migration:audit (against a reachable Postgres 16, not skipped), tbc, test. The chain is `&&`, so
reaching `test` is itself the statement that everything before it exited 0.

## Mutation runs

The cap notice, five mutants:

```
$ python scratchpad/mutbd.py
CAUGHT    Y1 hide the truncation notice
CAUGHT    Y2 always show it
CAUGHT    Y3 treat a missing verdict as capped
CAUGHT    Z1 never report the cap
CAUGHT    Z2 back to the 500 default
SURVIVORS: none
exit code: 0
```

Z2 matters more than the other four: it is the one proving a test pins the 900 rather than only
the notice that reports it.

The selection, five mutants, second run after closing a survivor:

```
$ python scratchpad/mutsel.py
CAUGHT    M1 back to the raw string sort
CAUGHT    M2 drop the future rule
CAUGHT    M3 a start on this exact instant has not started
CAUGHT    M4 ignore the tier
CAUGHT    M5 name tie-break reversed
SURVIVORS: none
exit code: 0
```

## The gate, demonstrated failing

A gate shown only to be quiet has not been shown to work.

```
$ mkdir docs/tbc/9999-01-01-gate-proof
$ printf -- '---\nstarted_at: 2030-01-01T00:00:00+08:00\n---\n' > .../think.md
$ git add docs/tbc/9999-01-01-gate-proof scripts/tbc/lib.mjs
$ npm run tbc:freshness

✗ tbc:freshness — 1 failure(s)
  [A30 / A22] 9999-01-01-gate-proof: started_at is 28733.6h AFTER now.

exit code: 1
```

and with the staged record removed, across the whole repo:

```
$ npm run tbc:freshness
✓ tbc:freshness
exit code: 0
```

---

## Findings

### 159 build records declare a start later than the commit that shipped them

class: a field that two mechanisms depend on, where one of them (a sort key) rewards
  inflating it and the other (an honesty check) is measured against it.
severity: high
sweep: the classifier is in the transcript; the reproducible form is
  `for d in docs/tbc/*/; do grep -m1 '^started_at:' "$d/think.md"; git log --diff-filter=A -1 --format=%cI -- "$d/think.md"; done`
  compared pairwise. 319 dirs carry both; 159 are impossible; earliest is
  `2026-07-28-install-tbc-gates`, the dir that installed the gates.
- Split by cause, with a five-minute grace for rounding: **74** are a real reading labelled `Z` by
  an author on UTC+8 (all July/August; September is zero, the convention having moved to an
  explicit offset), **79** are later than their own commit even read at `+08:00`, **6** are under
  five minutes.
- The 74 are a convention defect and harmless to ordering, since every record of that era shares
  the error — but they widen the manifest's `read_at` window by eight hours. The 79 are the real
  class, and 27 of them are this month.

### currentBuildDir could be captured by a single future-dated record

class: a selection whose key the selected party writes, with no upper bound.
severity: high
sweep: `node -e "import('./scripts/tbc/lib.mjs').then(m=>console.log(m.currentBuildDir()))"`
  before and after. Before the fix it returned `2026-09-22-self-elo`, a record declaring a start
  fifteen hours after its own commit; every build committed between then and 09:30 tomorrow would
  have had its documents validated against that dir instead of its own, while `tbc:freshness`
  reported success because a build dir *was* present in the diff.
- This is the 2026-08-13 failure — the wrong build validated, an unvalidated record shipped —
  reached through the timestamp rather than through the directory name.

### The instant comparison was a string comparison

class: a comparison written for a type it was never given; ISO text sorts by real time only
  when every value shares one offset.
severity: medium
sweep: `grep -rn "localeCompare" scripts/` — one other use remains, the name tie-break, where
  a text comparison is the intended semantics.
- Latent rather than active: every record before September used `Z` and every record in September
  uses `+08:00`, so no two values with different offsets have yet been compared. It would have
  fired on the first mixed pair. Every existing test used `Z`, which is why five cases passed over
  it.

### The tier in the sort key was untested

class: a mutation survivor that is a test gap rather than an equivalent mutant.
severity: low
sweep: the mutation run above; `M4 ignore the tier` survived the first pass.
- Dropping the tier and sorting on the instant alone passes every other case, because a demoted dir
  keys as 0 and every real build is a large positive number. The tier only earns its place below
  the epoch — which a transposed year reaches (`0202` for `2026`), and then a real timestamp sorts
  *below* a malformed one, inverting the original contract. Now pinned.

### The breakdown route truncated soonest and said nothing

class: one bounded read behind three routes, two reporting the bound and one silent.
severity: medium
sweep: `grep -rn "readPitchPeriod" src/app/api/` — three call sites, all now passing an
  explicit limit and returning the read's own `capped` verdict.
- Named as a residual twice before being closed, in the leaderboard closure and the capped-verdict
  closure. It was the most consequential of the three because it passed no limit at all: its bound
  was the 500 default, not 900.
