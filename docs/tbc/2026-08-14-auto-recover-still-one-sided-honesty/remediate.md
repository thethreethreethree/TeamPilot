# REMEDIATE — still-one-sided honesty terminal

## F1 — honest terminal instead of a false-promise re-transcribe card
Remediation: the After-Pitch page records the /auto-recover terminal status (`autoRecoverOutcome`). For
`still-one-sided` — the API's signal that the saved audio holds only ONE voice — it renders an honest terminal
("Only one side of this call was recorded… there's no second side to recover") rather than the manual
re-transcribe card, which would only reproduce the same one-sided result (a false-promise loop). The recoverable
outcomes are untouched: `could-not-decide` (the manual tap resolves the 2-voice ambiguity) and `failed`
(transient → retry) still show the card. `autoRecoverOutcome` resets on id-change so a session switch re-arms.
gate: the recoverable-vs-unrecoverable distinction rests on `autoSpeakerAssign`'s reasons, locked by its tests
(single-cluster → the unrecoverable terminal; ambiguous → the manual tap). The UI branch is code-review-covered
(no node render harness, consistent with the existing latches). class: honesty / continuity (§3.4 / §1.5.1).
severity: low-medium. Fixed.

## F2 — invalid token
`bg-surface-2` → `bg-surface/60` (the former has 0 uses and renders no background). class: presentation.
severity: low. Fixed.

## Honesty note
This is a gap in the auto-recover feature I shipped earlier today, found by tracing every terminal outcome for
workflow continuity (§1.5.1). The API already returned the distinct `still-one-sided` status to enable an honest
UI; the page had discarded it. Now it's used.
