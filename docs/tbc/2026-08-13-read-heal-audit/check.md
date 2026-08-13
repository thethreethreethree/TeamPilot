# CHECK — read-starvation fix audit remediation

## Verification run (A38)
Canonical command: `npm run check`.

## Findings

### F1 — blank read masked by the composite hasSignal → auto-heal never re-fired
file+line: `src/app/dashboard/sales-coach/[id]/after-pitch/page.tsx` (auto-heal effect) +
`src/lib/coach/v5/afterPitch.ts:160` (composite gate). The composite `hasSignal` is
`narrative.hasSignal || moments || scores || cueLoop`; deterministic scores are present for any
session with agent turns, so a BLANK narrative stored `hasSignal:true` and the heal (keyed on the
composite) never re-fired — the "Your read" stayed permanently blank.
class: error-dressed-as-no-data (INV22 class surviving at the UI layer).
severity: high
read-path: fixed by keying the heal on the NARRATIVE via `afterPitchNeedsHeal(existing)` — true when
no summary, no composite signal, OR `!existing.narrative.hasSignal`.
remediation: see remediate.md F1.
sweep-command: `grep -rn "afterPitchNeedsHeal\|narrative.hasSignal" src/app/dashboard/sales-coach/\[id\]/after-pitch/page.tsx src/lib/coach/v5/afterPitchHeal.ts`
— confirms the effect keys on the narrative, not the composite alone.

### F2 — stream path dropped finish_reason:length → streaming engines starve silently
file+line: `src/lib/llm/deepseek.ts` `parseSseDeltas` — parsed `finish_reason` into its type but never
read it, so the `finish_reason:"length"` starvation log existed only on the non-stream `call` path.
class: silent-starvation (visibility gap on the streaming callers — suggest/copilot/formulate/briefing).
severity: medium
read-path: fixed by tracking finish_reason across the stream and logging (EMPTY vs TRUNCATED, with
model + budget) at end-of-stream, mirroring the call path; content deltas still yield.
remediation: see remediate.md F2.
sweep-command: `grep -nE "finishReason|finish_reason|sawContent|stream finish_reason" src/lib/llm/deepseek.ts`
— confirms parseSseDeltas records + logs finish_reason:length.

## Accepted (not fixed — reasoned, not dismissed)
F3 (LOW): the 8000 clamp fixes the max reasoning room; a corpus ~3× the calibration re-starves and
raising the 7000 constant buys nothing (it clamps). Now ops-visible on both paths; the real fix for
scale is corpus/prompt-size reduction (founder-gated corpus-trim), and the F1 heal makes any future
re-starvation self-recover on next view instead of sticking. No code change.

## Tests
```
$ npx vitest run src/lib/coach/v5/__tests__/afterPitchHeal.test.ts
 Test Files  1 passed (1)   ·   Tests  4 passed (4)
$ npx vitest run src/lib/llm/__tests__/deepseek.provider.test.ts
 Test Files  1 passed (1)   ·   Tests  13 passed (13)  (3 new stream-path)
```
`afterPitchNeedsHeal` is detection-tested (the masked-blank case: the old composite-only predicate
returns false, the new one true). The React effect that consumes it is not node-exercisable; the
DECISION it funnels into is now a pure, tested helper.

## Full gate
```
npm run check — exit 0.
typecheck ✓ · lint ✓ · theme:audit ✓ · rls:audit ✓ · invariant:audit ✓ (0 violations)
tbc ✓ (docs · manifest · artifacts · residual · freshness)
Test Files 405 passed | 1 skipped (406); Tests 2799 passed | 15 skipped (2814)
```
