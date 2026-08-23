# BUILD — pending-audio review hard auto-terminal (audit D5, A20 default)

### the pending-audio review goes terminal after N retries
- write-path: `MeetingReview.tsx` — `pendingRetriesRef` counts consecutive 409s; a 409 sets `"pending-audio"`
  below `MAX_PENDING_RETRIES` (3) and the new `"no-recording"` terminal state at/above it; ANY non-409 result
  (ready or a different error) resets the counter to 0.
- read-path: a rep whose meeting genuinely wasn't recorded gets, after ~3 tries, a clear terminal ("This meeting
  doesn't appear to have been recorded… start a fresh meeting") with Back and NO endless Try-again; a fresh
  navigation remounts + resets, so a late-landing recording can still be re-checked.

### the counter can't prematurely terminate a real review
- write-path: the increment happens ONLY on `res.status === 409`; the reset (`pendingRetriesRef.current = 0`) runs
  on every non-409 branch (ready + non-409 error + network catch).
- read-path: a review that loads (even after an early 409) never shows the terminal — pinned by the reset test.

## Files
- `src/components/sales-coach/MeetingReview.tsx` — `MAX_PENDING_RETRIES` + `pendingRetriesRef` + the
  `"no-recording"` state/branch; the pending-audio comment updated (the hard terminal is now built, not deferred).
- tests: `MeetingReview.render.test.tsx` (NEW, +2: hard terminal after 3× 409 [no Try-again, Back present]; a
  non-409 recovery resets — no premature terminal).

## Ripple (holistic)
Client-only + additive — no route/server/schema change; the existing pending-audio/error/ready states are
unchanged below the threshold. Chosen threshold 3 is safe because chunks upload during the call (a review-time 409
is terminal-dominant), so 3 tries covers the narrow mid-upload window; the remount-resets escape bounds the
residual false-terminal risk. Closes D5's last flagged item as an A20 default (founder can tune the threshold/copy).
