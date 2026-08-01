# CHECK — required session naming (Phase 4)

## Audit
- ONE finish path now: manual End + both recording-complete callbacks all open the same required gate — no
  path can reach After-Pitch unnamed (§1.5.1 layer-3).
- Idempotent + safe: the finish PATCH sets status ended + clientLabel together; the 0070 trigger stamps
  ended_at once (re-finish keeps the real end time). Error keeps the modal open with a message — never traps
  the rep half-ended.
- Your Read + scoreboard are already the After-Pitch page's auto-generated content, so "directed to After-Pitch
  and Your Read" is satisfied by landing there.

## Findings (A26)
- Confirmed no other caller of the removed `endSession`/`endThenAfterPitch` remained (grep) before deleting.

## Verification
```
$ npx tsc --noEmit -p tsconfig.json
tsc_exit=0
```
Full `npm run check` is the CI gate.
