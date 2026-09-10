# BUILD - a recovery that succeeds and costs something must say what it cost

### Carry the detected loss out of the function that detects it
- write-path: `src/lib/coach/v5/transcriptRecovery.ts` - the read-back check that already proves
  whether `spoken_at` survived now sets a `timingLost` flag, and both transcript-writing outcomes
  (`recovered`, `saved-unlabelled`) carry it. Absent means the timing survived; the flag is only
  ever set by the read-back, never inferred from the ledger, so it reports what actually happened
  to THIS write rather than what should have happened.
- write-path: the early `saved-unlabelled` with `appended: 0` ("no-speech") is untouched. It never
  wrote a transcript, so it has no timing to have lost, and giving it a `false` would have implied
  the question was asked.
- read-path: every caller of `recoverSessionTranscript` can now distinguish a complete recovery
  from a partial one. Before this the two were identical: same status, same count, same shape.

### Return it to the caller instead of stopping at the server boundary
- write-path: `src/app/api/coach/sales-session/[id]/auto-recover/route.ts` - the `recovered` and
  `saved-unlabelled` responses include `timingLost: result.timingLost === true`. Strictly boolean,
  so an absent field on the outcome cannot arrive at a client as `undefined` and be read as a
  third state.
- read-path: the mobile app's `reReadRecording` returns `{ status, timingLost }`, and the
  After-Pitch card renders a plain-language note beside the outcome - what is missing, that the
  words themselves are all present, that nothing the rep did caused it, and that there is nothing
  to redo. It is an ADDITION to the outcome and never a replacement: saying only "something was
  lost" would be as wrong in the other direction as saying only "it worked".
- read-path: the three statuses that write nothing (`still-one-sided`, `could-not-decide`,
  `no-audio`) and every thrown branch report `timingLost: false`, because there is no transcript
  whose timing could have gone missing.

### The gate (A30)
- write-path: `tests/customer-missing.test.ts` in the app repository pins the note's content - that
  it names what is missing, that it says the words are all present, that it does not blame the rep,
  and that it offers no retry for a thing that cannot be redone.
- read-path: a future edit that turns the note into a failure message, or that quietly drops it,
  fails a named test rather than going silent. The old behaviour had no test because there was
  nothing to test: the information never left the server.
