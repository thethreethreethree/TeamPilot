# CHECK

## Commands run, by the project's own names

| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | clean |
| `npm run theme:audit` | **0 theme-bound leaks** — the green/red grade colours are saturated, not pale tints, so they pass |
| `npm run rls:audit` | 0 missing policies, 0 tenant-pin risks |
| `npm run invariant:audit` | 1,039 files, **0 violations** |
| `npx vitest run` | **4,585 passed**, 15 skipped, 662 files |
| `npm run build:ci` | **FAILED — and not on this build's code. See below.** |

## The build failure is real, and it is not mine

`npm run build:ci` fails prerendering `/dashboard/meeting-coach/prep`:

```
Error: Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
Export encountered an error on /dashboard/meeting-coach/prep/page, exiting the build.
```

The fast move was to call it unrelated and move on — it is a page in a different feature area that
nothing in this build touches. That reasoning is not a measurement (A38), so it was measured:
**HEAD was checked out into a clean worktree and built with no working-tree changes at all.**

| | Pages | Result |
|---|---|---|
| Working tree (this build) | 383 | fails at `/dashboard/meeting-coach/prep` |
| HEAD, clean worktree | 381 | fails at `/dashboard/meeting-coach/prep`, same error |

So **`main` is currently red on the secretless build**, which is what CI's Build step runs. That
is a finding about the repository, not an excuse for this build, and it is carried as R3 with the
diagnosis started.

**What this failure costs this build specifically:** the export halts at the first bad page, so
pages after it were not exercised. `/dashboard/sales-coach/[id]` is a dynamic route and is not
prerendered either way, but the honest statement is that **no production build has rendered this
build's UI**, and it cannot until `main` is green.

## Mutation testing

Nothing here passed on reasoning. Each claim was re-broken and the suite re-run.

**PitchDetail (21 tests):**

| Mutation | Result |
|---|---|
| P1 — re-sum section totals from element rows (the 0254 undo) | **1 failed** ✓ |
| P2 — drop the scaling explanation | **1 failed** ✓ |
| P3 — bare "Not counted" with no reason | **1 failed** ✓ |
| P4 — render a play chip at 0:00 when there is no timestamp | **1 failed** ✓ |
| P5a — show the footer Dispute button when disputing is unavailable | **1 failed** ✓ |
| P5b — show the per-ITEM Dispute link when unavailable | **survived → test added → 1 failed** ✓ |
| P6 — hide retired elements | **1 failed** ✓ |
| P7 — drop the grade WORD, leaving only colour | **2 failed** ✓ |
| P8 — invent a section list when the verdict is missing | **1 failed** ✓ |

**P5b is the one worth reading.** The first run reported it as caught; it was not. The mutation
string `      {onDispute && (` is a *substring* of the more-indented per-item occurrence, so Python
replaced the wrong one. Re-run against exact anchors, the footer was covered and the per-item link
was not — the same dead-control defect one layer down, where clicking it with no handler would
throw in the rep's face. A test was added and the mutation now fails.

That is a mutation run that lied, and it lied in the direction of comfort. Worth recording as the
technique's own failure mode: a mutation that does not apply where you think reports as "caught".

**PitchScorePanel (12 tests):**

| Mutation | Result |
|---|---|
| Q1 — treat a failed READ as an unscored pitch | **1 failed** ✓ |
| Q2 — replace the route's reason with "Something went wrong" | **2 failed** ✓ |
| Q3 — always offer Try again, even for `no_agent_turns` | **1 failed** ✓ |
| Q4 — report the dispute as sent regardless of the response | **1 failed** ✓ |
| Q5 — render the panel for a non-scorable session | **1 failed** ✓ |
| Q6 — trust the POST body instead of re-reading | **2 failed** ✓ |

**Dispute route (15 tests):**

| Mutation | Result |
|---|---|
| D1 — report success when the insert failed | **1 failed** ✓ |
| D2 — drop the pitch-read access gate | **1 failed** ✓ (re-run: first attempt did not apply) |
| D3 — attribute the score to the actor instead of the rep | **1 failed** ✓ |
| D4 — leak the database message | **2 failed** ✓ |
| D5 — treat a failed read as "not found" | **1 failed** ✓ |
| D6 — accept an empty note | **2 failed** ✓ |

## What is NOT verified

- **No browser has rendered any of this.** Blocked by the pre-existing build failure. The tests
  are jsdom.
- **No real pitch has been scored**, so no real score has been displayed. The screen has only ever
  rendered fixtures.
- **No dispute has reached a manager**, because no manager surface reads these events. R1.
- **Play chips have never played anything** — `onSeek` is threaded but unwired. R2.
