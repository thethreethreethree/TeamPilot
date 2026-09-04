# CHECK — a manager can delete a recording

Audited against the built files (§3.3.1).

## Canonical gate — `npm run check` (§3.2.3 / A38)

```
  Theme-bound leaks: 0
  Missing policies:      0
  Violations:            0
  tbc:docs tbc:manifest tbc:artifacts tbc:residual tbc:freshness — all OK
 Test Files  620 passed | 1 skipped (621)
      Tests  4093 passed | 15 skipped (4108)
exit: 0
```

## The check that matters most: the cron's OWN tests, unchanged

The retention job now calls the extracted helper instead of carrying the logic inline. The nine tests it already
had — written before this refactor existed and not touched by it — are what prove the extraction preserved
behaviour rather than my reading of the diff:

```
npx vitest run src/app/api/coach/sales-session/recording-purge-cron \
               src/app/api/coach/sales-session/__tests__/recording-purge-cron.route.test.ts
 Test Files  2 passed (2)
      Tests  9 passed (9)
```

## Mutation check (§3.3.4 / A30)

Both guards were broken deliberately and the named tests were watched to fail. Source restored afterwards.

```
manager gate removed (a rep may delete their own)        -> CAUGHT  (1 failed | 10 passed)
storage failure no longer blocks clearing the pointer    -> CAUGHT  (2 failed |  9 passed)
the UI delete becomes optimistic                         -> CAUGHT  (1 failed |  5 passed)
one click deletes, with no confirmation                  -> CAUGHT  (5 failed |  1 passed)
restored                                                 -> 11 + 6 passed
```

The second is the one worth the effort. Without it a failed storage call would still null `audio_asset_url`,
leaving the audio of a real conversation alive with nothing referring to it and nothing that would ever remove it —
and the API would have answered `200`.

## Class sweep (§3.3.3 / A26)

**Class:** *a mutation that reports success without asserting the effect landed* — specifically, clearing a pointer
to bytes that may still exist.

```
grep -rn "audio_asset_url: null" src/app src/lib --include=*.ts | grep -v __tests__
```

| Site | Asserts the bytes are gone first? | State |
| --- | --- | --- |
| `recording-purge-cron:119` | yes — via the shared helper, and it `continue`s on both failure kinds | pre-existing, now routed through the tested helper |
| `delete-recording:114` | yes — the helper must return `ok`, and the update asserts a rowcount | built here |

Two sites, both correct, and they are now correct for the same reason rather than by two separate authors having
remembered the same thing. No third site.

## Cross-module pass (§3.3.2 / A21)

**"Removing a recording"**, under every name it goes by:

| Surface | What it removes | Agrees? |
| --- | --- | --- |
| `recording-purge-cron` | audio + chunks beyond the rep's last twenty, transcript kept | source of truth for the rule |
| `delete-recording` (new) | audio + chunks for one session, on request, transcript kept | same removal, different trigger |
| mobile `recording-store.removeRecording` | the file on the PHONE, before upload | different thing entirely, and worth naming so nobody conflates them: a rep deleting a local recording is deleting their own unsent copy, not a server-side deletion, and the privacy page distinguishes the two |
| `privacy/page.tsx` | states that no on-demand delete exists | **now stale on this branch** — see F2 |

## Findings

Three findings, all recorded below and all addressed in remediate.md. This is not a clean bill: see
"Inspected and NOT clean-billed" for what was never exercised.

### F1 — THINK was written after the first file was edited

class: the ceremony performed as a record rather than as the method.
sweep: `git log --diff-filter=A --format="%H %ad" --date=iso -- 'docs/tbc/*/think.md'` compared against the first
  file mtime in each build — run for this build by hand: the helper was written at 08:52 and think.md at 09:05.
severity: low

The helper was extracted before `think.md` existed. §3.1 is explicit that THINK precedes any file edit. Recorded
rather than backdated: the manifest entry for §3.1 says so in its own words. Nothing about the design changed as a
result, because the design came out of reading the cron — but that is luck, not process.

### F2 — the privacy page contradicts this branch

class: a public statement about system behaviour that a code change silently invalidates.
sweep: `grep -rn "no button\|cannot be deleted\|not for a manager" src/app/privacy/page.tsx src/app/terms/page.tsx`
  — one hit, the paragraph named below. No second instance.
severity: high

`elostate.com/privacy` now says *"the product has no button that deletes a recording from our servers on demand —
not for a representative, not for a manager, not for an administrator."* That is true today and true of the privacy
branch alone. **It becomes false the moment this branch merges.**

This is the same class the privacy build was written to fix, arriving from the opposite direction: there, prose
described code nobody had read; here, code changes under prose nobody re-read. Remediation in `remediate.md`.

## Inspected and NOT clean-billed (§3.3.5)

**Inspected:** the new route and helper line by line, the refactored cron loop, all three test files, the cron's
pre-existing tests, the manager view's delete control, and the two sites in the class sweep.

**Not inspected:** the endpoint has **never been called against a live Supabase project**. Every storage
interaction in the tests is a fake. The behaviour a fake cannot check is the one that matters — whether
`storage.remove()` on a real object in `assets-v1` returns what this code assumes, and whether the service-role key
is permitted to remove it. Residual, not a pass.

### F3 — the cron refactor was written, then lost in a branch restack

class: a change that exists in the working tree and not in the commit that claims it.
sweep: `git show <commit>:<path> | grep -c removeRecordingAudio` against every file this build says it changed —
  one of five was zero.
severity: medium. Nothing was broken: the branch compiled, all 4,099 tests passed, and the cron kept working
  because it still held its own correct copy. What was wrong was **this document**, which claimed a single shared
  implementation that did not exist on the branch it described.

The restack — moving this branch off `main` and onto the retention disclosure, itself the fix for F2 — went
through `git stash push --staged`, a `reset --hard`, and a pop. The cron's modification survived into the working
tree and was never re-staged, and I did not check: I listed the file in the `git add` and assumed the commit
therefore contained it.

**Found by diffing the working tree against the commits at the end**, not by any gate. `git status` had been
showing ` M` on that path for three commits and I had been reading past it, because the same line also carried
another session's unrelated modifications.
