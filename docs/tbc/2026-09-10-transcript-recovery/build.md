# BUILD - no recording with speech in it is left without a transcript

### One rule replacing two special cases
- write-path: `src/lib/coach/v5/transcriptRecovery.ts` - `isRecoverable(state)`: a transcript missing an
  entire SIDE can still be improved by re-reading the saved audio; a two-sided one is canonical and is
  never touched. That single sentence covers blank, unknown-only, customer-only AND the original
  customer-missing gap, which were previously three different predicates in two different owners.
- read-path: a call with audio and no words is now accepted by the recovery it used to be refused by.

### Attribution as a refinement, never a precondition
- write-path: `labelFor(speakerId, agentSpeakerId)` returns `unknown` when nothing was assigned.
  `mayOverwriteUnlabelled(state)` allows an unlabelled write ONLY when the existing transcript holds no
  `agent` turn - the same precondition `/label-transcript` already enforces, for the same reason: real
  attributed speech must not be downgraded to an unlabelled re-read.
- read-path: an undecidable recording keeps its words instead of losing them, and no coaching verdict is
  manufactured from speech nobody has attributed (`generateSessionArtifacts` is not called).

### The sweep - the calls nobody reopens
- write-path: `src/lib/coach/v5/transcriptRecoverySweep.ts` + the
  `recover-transcripts-cron` route, hourly at :20, capped at 6 recoveries per run. Candidates are ordered
  OLDEST FIRST because `recording-purge-cron` keeps only each rep's 20 most recent recordings, so a
  dropped call is on a clock. A cheap segment pre-check runs BEFORE the marker is claimed, so a healthy
  session never burns the one attempt it will ever get.
- read-path: the nine-session backlog drains in two runs without the founder doing anything.

### One recovery, two triggers
- write-path: `/auto-recover` became a request shell over the same `recoverSessionTranscript`. Its status
  strings are unchanged so the After-Pitch page is untouched, with one addition - `saved-unlabelled` -
  which the page already treats correctly as a non-recovered terminal that offers the one-tap card.
  It also moved to `callerScopedDb(req) ?? (await createClient())`, so a Bearer caller is not read as
  anonymous.
- read-path: the on-open and unattended paths cannot drift into two different recovery behaviours.

### The question a rep can actually answer (Elostate-Sales-coach)
- write-path: `src/lib/audio/relabel-unknown.ts` rebuilds the voice question from a stored `unknown`
  transcript, because the picker's usual source is a store on the device that uploaded the call - empty
  for a call the SERVER recovered. `src/app/(app)/[id].tsx` derives the shown question with `useMemo`
  from either source rather than a second piece of state set in an effect.
- read-path: a recovered call is one tap from coachable instead of a wall of unattributed text.

### The timing, which answering would otherwise have destroyed
- write-path: the recovery now carries the diarizer's `start` through to `spokenAt` (the route it
  generalizes dropped it), and `startSecondsFor` in the app reads those offsets BACK out of `spoken_at`
  against the session start so the rep's answer re-sends them.
- read-path: the pace skill keeps working on a recovered call. An unknown time is `undefined`, never 0 -
  stamping untimed lines at the opening of the call would invent a pace reading.

### Answering without paying to transcribe the same audio twice
- write-path: `POST /api/coach/sales-session/[id]/attribute-unlabelled` relabels the rows the server
  ALREADY holds - `{ mine: boolean }`, scoped to `speaker = unknown` so a slower concurrent answer changes
  nothing. `/label-transcript` could not do this cheaply: it rebuilds the transcript from a client payload,
  against a 5,000-segment cap, with `spoken_at` reconstructed and re-sent - and a payload that forgets it
  deletes the timing in the act of making the call coachable.
- read-path: the web After-Pitch card asked the wrong question. For a recovered `unknown` transcript its
  only offer was to RE-TRANSCRIBE the saved audio - a second speech-to-text charge on a recording of up to
  42 minutes, to obtain words already sitting in the table - under copy claiming the read "came back
  blank" when it had not. It now asks whose voice it is and spends nothing.

### The gate (A30)
- write-path: `__tests__/transcriptRecovery.test.ts` (14) and `tests/relabel-unknown.test.ts` (10). In the
  route test, `not-applicable (200) when there is no transcript` was REWRITTEN to
  `RECOVERS a blank transcript` - that test was the defect written down as an expectation, and is why
  nothing ever tried to fix the nine.
- read-path: the durable defense is the sweep's own query - AUDIO PRESENT AND NO USABLE TRANSCRIPT - which
  catches a future path that stores audio without transcribing it, without that path's author cooperating.
