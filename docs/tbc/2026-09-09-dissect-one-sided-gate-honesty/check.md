# CHECK — the dissect gate stops leaving a one-sided session ambiguous forever

## Findings
This build produced **no findings** (no correctness defects surfaced during it). One design decision was
recorded rather than silently taken: the split-gate (dissect on agent-turns, moments on any-speaker) is
left in place per the founder's "targeted fix" choice; it is named in closure.md as the follow-up, not hidden.

## The gate bites (mutation, A38)
```
$ (mutate) salesDissect.ts:151  } else {   →   } else if ( agentTurns >= MIN_AGENT_SEGMENTS ) {
$ npx vitest run src/lib/coach/v5/__tests__/runAndStoreDissect.emit.test.ts
 × thin (0 agent turns) → emits coach.dissect_attempted reason 'no_agent_turns' (backoff, no LLM ran)
      Tests  1 failed | 3 passed (4)
$ (restore)
      Tests  4 passed (4)
```
The mutation was confirmed APPLIED (grep showed `} else if (` at line 151) before the result was read.
The failing test names the user-facing consequence (the one-sided session gets no backoff marker), not
just the mechanism.

## Visual verification (LAW 1 — looked at the render, did not infer)
The "One-sided" badge was rendered on both the dark dashboard surface (#18181B) and the light-theme white
surface, headless-screenshotted, and read. First render used `text-amber-300`: crisp on dark, but on WHITE
it washed out to the faintest element on the row — the amber-300-is-a-dark-color legibility failure LAW 1
exists to catch. Corrected to `text-amber-600 dark:text-amber-300` (border likewise) and re-rendered: the
light-theme badge now reads at neutral-pill weight while dark stays bright. Not a shipped defect — caught and
fixed inside the build by looking.

## Targeted suites
```
$ npx vitest run src/lib/coach/v5/__tests__/runAndStoreDissect.emit.test.ts \
                 src/app/api/coach/sales-session/list/__tests__/route.test.ts
 Test Files  2 passed (2)
      Tests  15 passed (15)
```

## Canonical command
```
$ npm run check
  typecheck · lint · theme:audit · rls:audit · invariant:audit · tbc · test
  invariant audit: 0 violations · 999 files scanned
  tbc: docs · manifest · artifacts · residual · freshness — five of five clean
  Test Files  625 passed | 1 skipped (626)
       Tests  4127 passed | 15 skipped (4142)
  Duration    63.45s
EXIT_CHECK=0
```
