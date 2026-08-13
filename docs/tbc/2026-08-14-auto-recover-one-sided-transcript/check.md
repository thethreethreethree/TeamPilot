# CHECK — auto-recover one-sided transcript

## Verification run (A38)
Canonical command: `npm run check`. Full-gate output + exit code pasted in closure.md.

## Findings (from the adversarial review that triggered this build, both in same-day code — now remediated)

### F1 — label-transcript overwrite could corrupt-and-lock a session on a failed delete
file+line: `src/app/api/coach/sales-session/[id]/label-transcript/route.ts:126` — the pre-fix
`await deleteSessionTranscriptSegments(id)` discarded the boolean. The delete never throws (returns false on
error), so a failed clear fell into the append loop → surviving old seqs 23505-no-op + new seqs insert → a
Frankenstein transcript mixing two diarizations that can end up "canonical" (has an agent turn) → every future
label 409s → permanently locked to a corrupt read.
class: data-integrity (destroy-then-partial-write).
severity: high (a live write path could corrupt + lock the canonical record).
read-path: fixed by checking the delete result — on `!cleared` → 500 and DO NOT append.
sweep-command: `grep -nE "const cleared = await deleteSessionTranscriptSegments|status.*failed" src/app/api/coach/sales-session/\[id\]/label-transcript/route.ts src/app/api/coach/sales-session/\[id\]/auto-recover/route.ts`
— confirms BOTH overwrite paths check the clear result before appending.

### F2 — BlankReadRecovery showed a false "wasn't transcribed" diagnosis in the wrong cases
file+line: `src/app/dashboard/sales-coach/[id]/after-pitch/page.tsx` — the card gated on a blank narrative (and
briefly on `scores.length===0`), which is mis-calibrated: the customer-missing case has `scores.length===2`
(so a length gate wrongly HID recovery on the exact reported session), while a two-sided STARVED read would
wrongly SHOW a "your side wasn't captured" message that is false.
class: honesty / false-diagnosis (§3.4).
severity: medium (misleading affordance; no data loss).
read-path: fixed by driving visibility + copy off the capture-gap DIRECTION (`detectCaptureGap`), and making
the manual card the fallback to the automatic recovery.
sweep-command: `grep -rn "detectCaptureGap\|shouldOfferBlankReadRecovery\|scoresLength" src/app/dashboard/sales-coach/\[id\]/after-pitch/page.tsx src/lib/coach/v5/blankReadRecovery.ts`
— confirms no `scoresLength` gate remains and visibility flows from the gap direction.

## Feature self-verification (auto-recover)
No new findings surfaced in self-review. The load-bearing properties are locked by tests (see build.md → Test
coverage): owner-only, canonical-never-clobbered, at-most-once STT, never-save-a-wrong-label, delete-guard.
The full gate result (typecheck/lint/audits/tbc/tests + exit code) is in closure.md.
