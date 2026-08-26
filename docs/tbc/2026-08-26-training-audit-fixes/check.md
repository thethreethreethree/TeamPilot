# CHECK — Training-system post-ship audit fixes

## Gate — the canonical command (A38)
```
$ npm run check
  (typecheck → lint → theme:audit → rls:audit → invariant:audit → tbc → test)
  Invariant audit: Violations 0
  tbc: docs + manifest (13) + artifacts + residual + freshness all ✓
  Test Files  580 passed | 1 skipped (581)
       Tests  3797 passed | 15 skipped (3812)
GATE_EXIT=0
```
(+2 F1 guard tests; existing brief/roleplay tests unchanged and passing.)

## What the tests prove
- F1 guard (+2 tests): `buildTeamBriefUserMessage` carries the per-rep names into the prompt, and degrades honestly
  ("omit repFocus") when there's no per-rep signal — so the "one focus each" section can no longer be structurally
  empty without a test failing.
- Existing parseTeamBrief honesty tests (5) still pass (whitelist, null-on-malformed, fence, caps).
- Existing roleplay parseReview/parsePracticeReview/route tests (12) still pass — the recovery-skip + focus clamp are
  additive and the default path is unchanged.

## Not unit-tested (bounded honestly)
The Training page's role-branch (F2/F3) and the roleplay recovery skip (Finding-1) are client fetch/effect wiring; the
change is a status-code branch + an early return, confirmed by reading. The per-rep grounding (F1 engine) is
integration-shaped (DB group + LLM) but its prompt contract is now test-locked and its parse is already tested.

## Findings
No findings — four confirmed audit defects fixed at the right depth (F1 grounded, not papered over), the F1 lesson
gated, and every reviewer-refuted hypothesis left correctly unchanged.
