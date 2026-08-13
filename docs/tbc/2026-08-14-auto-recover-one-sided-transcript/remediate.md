# REMEDIATE — auto-recover one-sided transcript

## F1 — label-transcript / auto-recover: check the delete result before appending
Remediation: both overwrite paths now `const cleared = await deleteSessionTranscriptSegments(id)` and, on
`!cleared`, return 500 WITHOUT entering the append loop. A failed clear can no longer leave a Frankenstein
transcript that 409-locks the session. The audio is saved, so the rep/auto-recover can retry cleanly.
gate: `label-transcript/route.test.ts` — "500s and does NOT append when clearing the broken transcript fails";
`auto-recover/route.test.ts` — "500 and does NOT append when clearing the broken transcript fails". Both assert
`appendTranscriptSegment` was not called. class: data-integrity. severity: high. Fixed.

## F2 — recovery affordance: drive visibility + copy off the capture-gap direction
Remediation: `detectCaptureGap` returns the DIRECTION (customer-missing / agent-missing / null). The
customer-missing case (talk_ratio caveat, scores.length===2) now correctly triggers auto-recovery, and the
manual card is the fallback shown only after auto-recover resolves without recovering — with copy that names
the actual missing side, never asserting a capture failure on a two-sided starved read.
gate: `captureGap.test.ts` pins customer-missing at scores.length===2 and null on a two-sided starved read;
`blankReadRecovery.test.ts` pins hidden-on-null-gap + hidden-while-in-flight + shown-when-resolved.
class: honesty / false-diagnosis (§3.4). severity: medium. Fixed.

## Honesty note
F1 and F2 are defects in code shipped earlier the same day (the recovery-overwrite fix + the first recovery
gate). Both were surfaced by an adversarial review and confirmed against the code + the founder's real session
before fixing — the founder-reported session itself disproved the `scores.length===0` calibration, which is why
the gate is now direction-based.
