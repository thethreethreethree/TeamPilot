# CHECK — still-one-sided honesty terminal

## Verification run (A38)
Canonical command: `npm run check`. Full-gate output + exit code in closure.md.

## Findings

### F1 — the still-one-sided auto-recover outcome showed a false-promise re-transcribe card
file+line: `src/app/dashboard/sales-coach/[id]/after-pitch/page.tsx` (the `else { setAutoRecoverResolved(true) }`
that collapsed every non-recovered status into the manual card). For `still-one-sided` (audio holds one voice),
re-transcribing reproduces the same one-sided result → the card is a false-promise loop.
class: honesty / workflow-continuity (§3.4 + §1.5.1 layer 3 — a UI dead-end/loop).
severity: low-medium (uncommon for a non-video session; a false promise + wasted taps, no data loss).
read-path: fixed by recording the terminal status and rendering an honest terminal for `still-one-sided`
instead of the re-transcribe card. Incidental: the `bg-surface-2` token I first reached for has 0 uses in the
codebase (would render no background) — corrected to the valid `bg-surface/60` in the same change.
sweep-command: `grep -n "autoRecoverOutcome\|still-one-sided\|bg-surface/60" src/app/dashboard/sales-coach/\[id\]/after-pitch/page.tsx`
— confirms the outcome is tracked, the still-one-sided terminal renders, and the token is valid.

## Tests
The recoverable-vs-unrecoverable distinction is locked by `autoSpeakerAssign.test.ts` (single-cluster →
unrecoverable terminal; ambiguous → the manual tap resolves it). The UI branch itself has no node harness (see
build.md). Full gate result in closure.md.
