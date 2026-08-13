# BUILD — honest terminal for still-one-sided auto-recover

### after-pitch page: track the auto-recover outcome + honest still-one-sided terminal
read-path: `src/app/dashboard/sales-coach/[id]/after-pitch/page.tsx` — the `autoRecover` callback records the
terminal status in `autoRecoverOutcome`; `BlankReadRecovery` reads it.
write-path: none (client state only). On a non-recovered outcome the status is stored; `still-one-sided` renders
an honest terminal ("Only one side of this call was recorded… no second side to recover") INSTEAD of the manual
re-transcribe card, which would only reproduce the one-sided result. `autoRecoverOutcome` resets on id-change.
Every other non-recovered outcome (could-not-decide / failed / already-attempted) keeps the manual card, where a
tap/retry genuinely helps. Corrected an invalid `bg-surface-2` token → `bg-surface/60`.

## Test coverage
The visibility predicate (`shouldOfferBlankReadRecovery`) remains detection-tested. The still-one-sided terminal
is a UI-only branch on client state with no node render harness (consistent with the existing autoGen/autoRecover
latch pattern, which is also verified at the pure-predicate boundary + code review). The distinction it rests on
— which auto-assign reasons are unrecoverable — is locked by `autoSpeakerAssign.test.ts` (single-cluster vs
ambiguous vs decided).
