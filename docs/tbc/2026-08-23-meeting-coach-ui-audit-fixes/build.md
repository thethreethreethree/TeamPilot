# BUILD — Meeting Coach UI audit fixes

### the panel no longer promises a review for a session that never recorded (H1)
- write-path: `MeetingCoachingPanel` tracks `wasLiveRef` (set when `coach.status==="live"`); `endSession` only sets
  `endedSessionId` + POSTs `/end` when `didRecord` is true.
- read-path: a mic-denied / errored / instant-stop session returns straight to SETUP — no ENDED screen, no false
  "recording saving… review will be ready", no 409-looping Review link.

### Start flushes the prep before handing off (H2)
- write-path: `savePrep()` is the shared PATCH; `scheduleSave` records the pending values; `flushSave()` cancels the
  debounce + awaits a final PATCH; the Start handler awaits `flushSave()` and only calls `onStart` if it persisted.
- read-path: typing a goal then tapping Start (within the 700ms debounce) now binds a SAVED prep, not an empty one;
  a save failure shows an error and blocks Start (`saveError`, M1).

### legible in light mode (M2/M3) + keyboard-reachable upload (M4) + no duplicate heading (M5)
- write-path: accents across Panel/Review/TrendTile changed to `text-{c}-700 dark:text-{c}-300`; MeetingPrepUp
  rows/dropzone changed to `bg-surface-raised`/`bg-surface`/`border-default` tokens; the file input class changed
  `hidden`→`sr-only` + a focus-within ring; the trend tile heading string renamed to "Meeting trend."
- read-path: the accents are legible on both the white light ground and the dark ground; the Prep-up rows/dropzone
  are visible on light; keyboard users can Tab to + activate the upload; the setup screen shows one heading, not two.

### review continuity (L3/L4) + tap target (L5)
- write-path: `MeetingReview` gains a `retryable` state (set from `res.status>=500`) gating the Retry button, a
  `BackToMeetingCoach` link component in the error/pending states, and the remove-topic ✕ gains padding.
- read-path: Retry shows only when it can help (5xx/network); a "← Back to Meeting Coach" escape exists from the
  error/pending states; the ✕ is a comfortable tap target on mobile.

## Files
- `src/components/sales-coach/meeting/MeetingPrepUp.tsx` — flush-on-Start, save-error, tokens, sr-only input, tap target.
- `src/components/sales-coach/MeetingCoachingPanel.tsx` — wasLive gate; theme-aware accents.
- `src/components/sales-coach/MeetingReview.tsx` — theme accents; retryable-gated Retry; back link.
- `src/components/sales-coach/MeetingTrendTile.tsx` — theme accents; heading rename.
- tests: `MeetingPrepUp.render.test.tsx` (+2 — H2 flush-before-Start; M4 sr-only input).

## Ripple (holistic)
UI-only; no route/data/schema change. Accents verified collision-safe (base-token swap carries opacity variants;
no leftover bare `-300/-400`, no double-apply). Backend/integration/security findings are a SEPARATE commit so a
UI regression can't be entangled with a backend one.
