# REMEDIATE - no recording with speech in it is left without a transcript

### F1 - a test asserted the defect
fix: `not-applicable (200) when there is no transcript / no agent turns` rewritten to
`RECOVERS a blank transcript - a call with audio and no words is exactly the case to fix`, with the
production count and dates in the comment above it. Two more tests added beside it:
`saves a blank transcript as UNKNOWN when the voice cannot be identified` and
`REFUSES to overwrite real agent speech with an unlabelled re-read`.
gate-or-promise: GATE. The rewritten test fails if the empty case is ever refused again, and it names the
nine sessions in its own body so a future reader cannot re-derive the old expectation as reasonable.

### F2 - a confident zero from the wrong table
fix: the bucketing script re-run against `coaching_transcript_segments`, the name taken from
`getSessionTranscript` in the data layer rather than recalled. Every figure in think.md replaced with the
corrected run; the earlier "13 of 16" estimate is superseded by the measured 9.
gate-or-promise: PROMISE, honestly labelled. This was a throwaway measurement script in the scratchpad,
not shipped code, and no gate covers a script that is not in the repo. What is in the repo is the table
name in exactly one place - the data layer - which is where the corrected run got it.

### F3 - two HTTP codes collapsed into one
fix: `RecoveryResult` failures carry `where: "upstream" | "internal" | "invalid"`; the route maps
upstream -> 502, internal -> 500, invalid -> 422, with a comment saying they are not interchangeable.
gate-or-promise: GATE, and it was the gate that caught it in the first place - the existing route test
pins the codes and failed with `expected 502 to be 500` the moment the extraction flattened them.

### F4 - answering would have destroyed the recovered timing
fix: `startSecondsFor(startedAt, spokenAt)` in the app reads the offsets back out of `spoken_at`;
`attributionFromTranscript` omits the key entirely when the answer is unknown rather than sending 0. The
recovery itself now also carries the diarizer's `start` through to `spokenAt`, which the route it
generalizes had been dropping.
gate-or-promise: GATE. `the offset is read back out of spoken_at, so answering keeps the timing`,
`an unknown time is never a zero` and `a line with no timestamp carries NO offset key at all` all fail on
a regression, and mutations MA and MC were run to prove they do.

### F5 - an unsubstituted placeholder in the previous build's record
fix: `docs/tbc/2026-09-10-derived-daily-goal/closure.md` line 36, `"opened_at": "%(NOW)s"` replaced with
the real timestamp `2026-09-10T15:58:00+08:00`.
gate-or-promise: PROMISE. `tbc:residual` reads `opened_at` as a string and has no concept of a value that
parses but means nothing. A checker for it would be process machinery the founder has not asked for, and
this build is not the place to add one - recorded here so the next person to touch the residual verifier
has the case in front of them.

### F6 - the sweep was an unbounded cost loop
fix: `MAX_TRANSIENT_RETRIES = 3` in `transcriptRecovery.ts`. `releaseMarker` counts prior
`coach.transcript_recovery_retry` events for the session, refuses to release past the budget, and refuses
to release at all when the count cannot be read - failing closed, because not releasing costs one delayed
recovery while releasing blindly is the loop itself.
gate-or-promise: PROMISE, and named as one. The budget is enforced in code and covered by the existing
suite, but nothing FAILS if a future caller adds a seventh release path that skips the tally. The honest
statement is that this is a bounded loop, not a gated one.

### F7 - the recovery could succeed and silently drop the timing
fix: after the atomic replace, if timestamps were SENT, read one back. `replace_session_transcript`
carries `spokenAt` only from 0249; the 0212 version selects a literal null, and BOTH return a count and
succeed - so a deploy ahead of the migration recovers the words perfectly and loses the timing with
nothing anywhere saying why. Production's ledger still ended at 0248 when this shipped. The check records
`coach.transcript_recovery_timing_lost` naming the session, so those calls can be re-recovered once the
migration lands. It deliberately does NOT release the marker: re-running would spend transcription every
hour for a condition only a migration can clear.
gate-or-promise: PROMISE, and a self-checking one - the code verifies its own write rather than trusting
it, which is the part worth keeping. Nothing FAILS on recurrence, so it is named as a promise.

## The class, swept to its boundary (A26 -> A30)
The class is not "auto-recover refused empty transcripts". It is **a session holds audio that no path
will ever transcribe**. Fixing the one precondition would leave the class alive for the next path that
stores audio without transcribing it.

The boundary is therefore not a document and not a code comment. It is the sweep's own candidate query:

    audio_asset_url IS NOT NULL  AND  auto_recover_attempted_at IS NULL  ->  and no usable transcript

That query does not know or care which code path created the session. A future upload route that stores
audio and forgets the words is repaired within the hour by machinery its author never has to know about -
which is A30's actual test: *does anything mechanical notice, without the author's cooperation?*
