# CHECK — uploaded-recording sessions generate the summary

## Verification run (A38 — canonical command + exit code)
Canonical command: `npm run check` (typecheck && lint && theme:audit && rls:audit && invariant:audit && tbc
&& test).

## Findings

### F1 — uploaded-recording sessions never generated the post-call summary/dissect (regression from feature 0a873a3c)
file+line: `src/app/api/coach/sales-session/[id]/label-transcript/route.ts` (appended the transcript, then returned with no generation trigger).
class: a transcript-append entry point that does not trigger the post-call generation (`generateSessionArtifacts`) the surfaces downstream depend on — "feature returns 200 but the workflow it feeds never runs" (§1.5.1 Layer 3).
severity: high — the summary the user opens a session to see was silently empty for EVERY uploaded call (a core surface), while live sessions worked; presents as a missing feature, not an error.
sweep-command: `grep -rln "appendTranscriptSegment" src/app/api/coach/sales-session --include=*.ts | grep -v __tests__` — the transcript-append entry points: `/finalize` (generates), `/segments` (feeds finalize's body), `/label-transcript` (the uploaded path — MISSING, fixed here). No other append route lacks the trigger.

### F2 — the F1 generation-scheduling could 500 a label whose transcript already saved (found in post-ship adversarial self-review)
file+line: `src/app/api/coach/sales-session/[id]/label-transcript/route.ts` — the post-append `getCurrentCompanyId()` + `getSessionTranscript(id)` ran UNGUARDED before the 200 response.
class: best-effort follow-on work that can throw BEFORE the load-bearing response — turning a bonus failure (generation) into a primary failure (the label). `getSessionTranscript` rethrows DB read errors by contract (INV22).
severity: medium — a transient DB read blip would 500 a label whose transcript is saved; the rep's retry then hits the 409 already-has-transcript guard (a hard trap). No data loss, but a stuck user.
sweep-command: `grep -n "after(\|getSessionTranscript\|getCurrentCompanyId" src/app/api/coach/sales-session/[id]/label-transcript/route.ts` — the scheduling block is now wholly inside a try/catch; the append + 200 response are outside it. See remediate.md F2.

## Audit-clean (non-defect) — the live flow + the manual/cron paths
The live flow (`useLiveCoaching` → `/finalize`) already generated the full set and is unchanged (finalize now
just calls the shared helper). The manual `/summarize` POST and the dissect-backfill cron are separate,
intentional paths — left untouched. The finalize refactor is behavior-preserving (its existing tests are unchanged and still pass in the run below).

## Audit-clean (post-ship class sweep) — every transcript-producing path is covered
Completing the F1 class (A26) across ALL transcript-producing paths, not just the one that surfaced it:
- **Live** → `useLiveCoaching` → `/finalize` — generates (unchanged).
- **Fresh upload** → `/upload-recording` → `/label-transcript` — generates (F1 fix).
- **Orphan recovery** → `/retranscribe` → `/label-transcript` — generates (F1 fix). `retranscribe` (like
  `upload-recording`) does NOT append the transcript itself; it returns diarized segments that funnel through
  `/label-transcript` (route comment, lines 29-32), so it inherits the fix — verified, NOT a second gap.
- **`/segments`** → dev/manual insert with NO client caller (route comment) — not a user path.
So the two upload entry points both route through the single fixed route, and no transcript-producing path is
left without a generation trigger. Class closed.

## Targeted tests
```
$ npx vitest run src/app/api/coach/sales-session/[id]/label-transcript src/app/api/coach/sales-session/[id]/finalize
 Test Files  2 passed (2)
      Tests  12 passed (12)
```

## Full gate
```
$ npm run check
typecheck ✓ · lint ✓ · theme:audit ✓ · rls:audit ✓
invariant:audit ✓ — Violations 0
tbc ✓ — docs · manifest (16) · artifacts · residual (2) · freshness all ✓
test ✓ — Test Files 394 passed | 1 skipped (395); Tests 2723 passed | 15 skipped (2738)
CHECK_EXIT=0
```
