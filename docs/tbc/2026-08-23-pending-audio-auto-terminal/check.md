# CHECK — pending-audio review hard auto-terminal (audit D5)

## Gate — the canonical command (A38)

```
$ npm run check
  (typecheck → lint → theme:audit → rls:audit → invariant:audit → tbc → test)
  Invariant audit: Violations 0
  Test Files  571 passed | 1 skipped (572)
       Tests  3735 passed | 15 skipped (3750)
EXIT: 0
```

## What the tests prove
- **`MeetingReview.render.test.tsx` (NEW, 2):** with the dissect route returning 409, the review offers Try-again
  on the 1st/2nd attempts, then after the 3rd (`MAX_PENDING_RETRIES`) shows the hard terminal — "doesn't appear to
  have been recorded", Try-again gone, Back present. And a 409-then-200 sequence renders the review (recovered),
  never the terminal — so the counter can't prematurely terminate a real review.

## Honest limit
The threshold (3) is a judgment default (A20): safe because a review-time 409 is terminal-dominant (chunks upload
during the call), and the remount-resets escape covers the rare late-landing recording. The exact number is the
founder's to tune; the honesty behaviour (no endless Try-again on a genuinely-unrecorded meeting; no premature
terminal on a recoverable one) is what the tests pin.

## Findings
No findings.
