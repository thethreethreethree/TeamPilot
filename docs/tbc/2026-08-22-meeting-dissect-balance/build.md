# BUILD — Speaker balance in the Dissect

### Speaker balance (imbalance monitor, post-hoc)
- write-path: `generateMeetingDissect` calls `computeSpeakerBalance(args.segments)` (the batch-diarized turns)
  and attaches it to the `MeetingDissect`; `generateAndStoreMeetingDissect` includes `balance` in the stored
  `meeting.dissect_generated` payload.
- read-path: `MeetingReview` renders a balance line (Balanced / Uneven + the note) beside the effectiveness read.

## Files
- `src/lib/coach/strategy/meeting/speakerBalance.ts` — pure `computeSpeakerBalance` (word-share, null < 2
  speakers, DOMINANCE_PCT threshold) + 4 tests.
- `parseMeetingDissect.ts` — `balance: SpeakerBalance | null` on the type (parse leaves it null — it's not from
  the LLM).
- `generateMeetingDissect.ts` — compute + attach + store.
- `MeetingReview.tsx` — render.

## Design
Balance does NOT affect `hasSignal` (a purely-social meeting still stores nothing); it's supplementary on a
signal dissect. PROPOSED field + threshold (founder can drop/tune). No sales/server change.
