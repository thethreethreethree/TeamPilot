# CHECK — read means shown

## The canonical gate

```
$ MIGRATION_AUDIT_PSQL="docker exec -i ics-postgres psql -U ics" MIGRATION_AUDIT_MAINT_DB=ics npm run check
$ echo "CHECK_EXIT=$?"
CHECK_EXIT=0

 Test Files  703 passed | 1 skipped (704)
      Tests  5398 passed | 15 skipped (5413)
```

Twelve steps: `typecheck && lint && theme:audit && rls:audit && invariant:audit &&
reachability:audit && writer:audit && enum:audit && migration:audit && tbc && test`. Run with
output redirected to a file and the exit code read on the next line, not through a pipeline — the
lesson of this morning's wrong-exit-code finding.

## The tests, and what each one would have caught

`NotificationBell.render.test.tsx`, eight new cases:

| Case | The defect it names |
|---|---|
| posts the ids it displayed, never `{ all: true }` | **the bug** — an unbounded write from a bounded list |
| drops the badge by what it showed, not to zero | a recipient with 134 still waiting being told they are done |
| posts nothing when every shown row was already read | `{ ids: [] }` is a 400 from the body schema |
| "Mark all read" still marks all | over-correcting by deleting the deliberate path |
| names the total when there are more than it fetched | a page presented as the set |
| says nothing when the page IS the set | a count line on every panel forever |
| says nothing when the response has no count | an older bundle, and absent read as zero |
| `unread: null` shows no badge | a number the server could not stand behind |

`scripts/tbc/__tests__/frontMatter.test.ts`, four cases — see the finding below.

## Mutation probes — run, not reasoned about

**Reverting the one line** (`markShownRead` → `markAllRead` on open):

```
FAIL  … > posts the ids it displayed, never { all: true }
FAIL  … > drops the badge by what it showed, not to zero
      Tests  2 failed | 30 passed (32)
```

Two rather than one is the right number: the write and the badge are separate claims, and a fix
that corrected only the POST would leave the badge lying until the next poll.

**Reverting the front-matter regex** to `^---\n`:

```
FAIL  … > THE REGRESSION — reads front matter written with CRLF line endings
FAIL  … > reads a nested key the same way under CRLF
      Tests  2 failed | 2 passed (4)
```

---

## Findings

### The TBC gate had been validating a build from four hours earlier

class: a parser whose failure mode is `null`, feeding a selector that treats `null` as "un-dated"
  and silently falls back — so a document that cannot be read is indistinguishable from one that
  was read and found fine. Not a line-ending bug; a **silent-fallback** bug that a line ending
  happened to trigger.
severity: high
sweep: `node -e "const fs=require('fs');const d=fs.readdirSync('docs/tbc').filter(x=>fs.existsSync('docs/tbc/'+x+'/think.md'));console.log(d.filter(x=>!/^---\n/.test(fs.readFileSync('docs/tbc/'+x+'/think.md','utf8'))))"`
  — the boundary is every `think.md` in the repo, and the command prints the ones the gate cannot see.

- Found while asking why `tbc:manifest` kept printing `build: docs/tbc/2026-09-22-coach-assessment`
  when the build in hand had started three hours later.
- `frontMatter()` matched `/^---\n/`. A `think.md` written with CRLF opens `---\r\n` and does not
  match, so the function returned `null`; `currentBuildDir()` then keyed that build on its
  directory NAME, which never beats a real `started_at`.
- **30 of 333 `think.md` files were invisible**, the oldest from 2026-08-19. SEVEN of them are
  from today — every build since 10:07: `recordings-tab` (10:07), `rep-progress` (11:05),
  `pattern-actions` (11:20), `founder-rulings` (11:45), `review-flags` (12:37), `previous-shape`
  (12:42) and this one (12:58). Every one of those builds had `tbc` pass, and every one of those
  passes was about `coach-assessment`, which started at 09:05 and is the last readable record of
  the day.
- I wrote "six, from 11:05" first and it was wrong — `recordings-tab` at 10:07 is in the list too.
  Corrected from the sorted output rather than from the sentence I had just written.
- What went unchecked is the RECORD's conformance — the manifest's minimum set, the artifact
  structure, the residual ranking. The software in those builds passed the other eleven steps.
  This document is the first of the seven whose structure the gate has actually examined, and it
  failed three artifact rules on the first run, which is a fair measure of what was being missed.
- The remediation and the gate that now prevents it are in `remediate.md`.

## What this run does not cover

- **The notifications route has no test of its own.** The unread count is exercised through the
  component's fetch mock, not against Postgres. A change to `.is("read_at", null)` would fail
  nothing. Recorded as residual R2 rather than papered over.
- **No browser.** jsdom again — the twenty-first consecutive build without a real render.
