# CHECK

## Commands run, by the project's own names

| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` (project-wide) | clean |
| `npm run theme:audit` | 0 theme-bound leaks |
| `npm run rls:audit` | 0 missing policies, 0 tenant-pin risks |
| `npm run invariant:audit` | 1,036 files, **0 violations** |
| `npx vitest run` | **4,537 passed**, 15 skipped, 659 files |

The invariant audit is the one that matters for a new route: it independently confirms the route
exports `maxDuration` (LLM routes must, or they time out in production), references a recognised
auth/tenant gate (no anon-writable route), and returns no raw error `.message` to the client
(CWE-209). Those are three of this build's claims checked by something other than its own tests.

**Not run: `npm run build:ci`.** No UI in this build.

## Mutation testing

30 route tests passed on the first run. That is the moment to distrust, not to ship — a route test
suite written from the same understanding as the route agrees with it by construction. Each of the
five hypotheses, plus the failure gate, was re-introduced as a mutation:

| Mutation | Result |
|---|---|
| M1 — file the score against the caller (`auth.user.id`) | **1 failed** ✓ |
| M2 — `recordedAt = now()` | **1 failed** ✓ |
| M3 — remove the session-kind gate | **2 failed** ✓ |
| M4 — forward the outcome unmapped | **2 failed** ✓ |
| M5 — drop the scoped client on the GET read | **1 failed** ✓ |
| M6 — store even when generation failed | **4 failed** ✓ |
| restored | 30 passed ✓ |

And the reader, where the whole risk is re-deriving what 0254 stores:

| Mutation | Result |
|---|---|
| N1 — re-sum sections from element rows | **1 failed** ✓ |
| N2 — coerce a null timestamp to 0 | **1 failed** ✓ |
| N3 — drop retired elements | **1 failed** ✓ |
| N4 — swallow the read error as "no pitch" | **1 failed** ✓ |
| N5 — skip the rubric-order sort | **1 failed** ✓ |
| restored | 10 passed ✓ |

N1's fixture is built to discriminate rather than to agree: the stored Delivery verdict is 19.2
and the element rows sum to 9.5, and the test asserts **both** — that the reader returns 19.2 and
that re-summing gives something else. A fixture where those happened to match would have passed
against the bug.

## Corrected during the build

The §3.5 manifest entry initially claimed the sold-rate is *"one of the two hard metrics"* and
cited lines 364-377. Reading §3.5 showed both were wrong: it lives at 376-389, and the hard
metrics it names are meeting duration and completion/resolution rate — the sold-rate is this
domain's analogue of completion rate, not a clause verbatim. The line range and the claim were
corrected rather than left, since a manifest entry asserting a read is exactly the thing A22 says
must not be written from memory.

## What is NOT verified

- **Nothing renders a Pitch Score.** The route returns JSON no screen consumes. `curl` would work;
  a rep cannot reach it.
- **No real pitch has been scored.** The route has never been called against a live session. Its
  behaviour is proven against mocks and its migrations against real Postgres, which is not the
  same as end-to-end. The launch gate — 10 to 20 real recordings, manually graded in parallel —
  is now *possible* and has not started.
- **Scoring is on-demand only.** No session is scored automatically.
