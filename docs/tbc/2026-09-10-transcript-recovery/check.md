# CHECK - no recording with speech in it is left without a transcript

### F1 - a test asserted the defect, which is why nothing ever tried
class: the-expectation-was-the-bug
sweep: every precondition in the two recovery routes, against the four transcript states that can exist
severity: high
`not-applicable (200) when there is no transcript / no agent turns` was a deliberate, commented test that
had never once failed. It pinned the behaviour that left nine production sessions unrecoverable for up to six weeks. The
refusal was not an oversight anyone would find by reading the code - the code was doing exactly what its
test said it should. Rewritten to `RECOVERS a blank transcript - a call with audio and no words is
exactly the case to fix`, with the production numbers in the comment so the next reader cannot re-derive
the old expectation from first principles.

### F2 - my own measurement reported a confident zero from the wrong table
class: measured-the-neighbouring-table
sweep: the bucketing script re-run against `coaching_transcript_segments`, the name taken from `getSessionTranscript` rather than recalled
severity: medium
The first bucketing run queried `sales_session_transcript`, which does not exist. PostgREST returned an
error object, the script pushed nothing, and the summary printed `transcript segments total 0` alongside
`audio + NO transcript 16` - a clean, plausible, entirely wrong table. It was only caught because the
error line was printed above the numbers. Corrected run: 2,268 segments, and the dropped count is NINE,
not sixteen and not the thirteen an earlier estimate had carried. Every number in think.md is from the
corrected run. The lesson is the one A36 keeps paying out: a result that agrees with what you expected is
the one to check hardest.

### F3 - my refactor silently collapsed two HTTP codes the route separated on purpose
class: a-refactor-that-flattened-a-distinction-it-did-not-notice
sweep: every failure return in the extracted resolver, against the route test's pinned codes
severity: medium
Moving the route body into a library, I mapped failures as `transient ? 502 : 422`. The original
distinguished 502 (storage / speech-to-text - an upstream outage worth retrying) from 500 (our own
database write). The existing route test caught it: `expected 502 to be 500`. The test was right and I
was wrong. The result type now carries `where: "upstream" | "internal" | "invalid"` so the distinction
survives the extraction instead of being re-derived from a boolean that cannot express it.

### F4 - answering the question would have destroyed the timing the recovery had just created
class: the-fix-for-one-half-breaking-the-other-half
sweep: every writer of `spoken_at` on the recovery-then-label path
severity: high
`/label-transcript` rebuilds `spoken_at` from the `startSeconds` in the payload it is sent. The stored
transcript carries `spoken_at` but no offsets, so the obvious app payload - text and seq - would have
stamped every segment NULL. The rep's single tap would have made the transcript coachable and silently
deleted the timing that makes the pace skill work, in the same request. `startSecondsFor` reads the
offsets back out of `spoken_at` against the session start. Pinned by
`the offset is read back out of spoken_at, so answering keeps the timing`.

### F5 - a placeholder shipped unsubstituted into the PREVIOUS build's own record
class: the-record-was-not-read-after-it-was-written
sweep: `%(` across docs/tbc
severity: low
The daily-goal build's closure.md reads `"opened_at": "%(NOW)s"` - a Python format placeholder that my
edit script never substituted, committed in `3def4771` and printed back verbatim by `tbc:residual` every
run since. Nothing failed; the gate has no concept of a placeholder that parses as a string. Recorded
here and corrected in remediate.

### F6 - the sweep I had just written was an unbounded cost loop
class: a-guard-that-was-right-for-a-human-and-wrong-for-a-machine
sweep: every `releaseMarker()` call site, re-read against an unattended caller instead of a rep pressing a button
severity: high
Found by opening R4, the residual I had marked "high confidence it does not matter". The original route
releases the at-most-once marker on a TRANSIENT failure so a momentary outage does not permanently burn a
session's one recovery attempt. That is correct under a rep pressing a button. Under an HOURLY sweep it is
a different mechanism entirely: a recording that can NEVER be transcribed fails, releases, and is picked up
again next hour, forever, spending a speech-to-text charge every time and never finishing.

It is not hypothetical, and the measurement is why R4 was worth opening. Three of the nine dropped sessions
are 39-43 MB against 619 KB for a known 149-second call - hours of audio, and precisely the files most
likely to exceed the 300-second function budget. **The one case with the most to recover is the one that
would have looped.** Bounded by `MAX_TRANSIENT_RETRIES = 3`, tallied in an append-only event so the budget
survives a restart, and failing CLOSED when the tally cannot be read.

### F8 - the sweep would have argued with the person it asked
class: the-automation-overwriting-the-human-answer-it-solicited
sweep: every transcript shape a REP can produce through the picker, not only the shapes the system writes
severity: high
Found by walking what a rep actually does with the new picker rather than by a test. When they answer
"that was the customer, not me" - the one-sided capture the picker exists for - every segment is labelled
`customer`. `isRecoverable` said "zero agent turns means recoverable" and `mayOverwriteUnlabelled` said
"zero agent turns means safe to overwrite", so the next sweep would have replaced their deliberate answer
with `unknown` within the hour. The system would have asked a question, been answered, and then overruled
the answer on a timer.

A customer-only transcript with no unknowns can ONLY be a human answer: recovery writes all-`unknown` or
agent-plus-customer, live capture writes agent turns. Agent-only is not symmetric and stays recoverable -
that is the original customer-missing gap.

FIXING IT PRODUCED THE OPPOSITE ERROR, and the existing suite caught that too. My first attempt returned
early on "any unknown turn", which would have let the sweep re-read a perfectly good TWO-SIDED call:
`/segments` accepts `unknown` per turn, so a live-coached transcript can hold agent, customer and unknown
together. `refuses a two-sided transcript even when unknown turns are mixed in` failed immediately. The
two-sided check now runs first.

### F9 - the sweep ran ahead of the migration, in production, today
class: a-race-i-described-in-my-own-record-and-then-lost
sweep: the production migration ledger against the first live sweep run
severity: high
think.md's Ripple section named this exact risk - "a deploy-before-migrate loses the timing" - and then it
happened at 17:20 while the founder was still being handed the command to apply 0249. The sweep recovered
a 42-minute call as 106 correctly attributed segments with every `spoken_at` null, and F7's read-back
guard logged `coach.transcript_recovery_timing_lost` naming it. The guard worked; the race was still lost.
Because the at-most-once marker is now set, recovering that timing means clearing markers and paying for
transcription a second time.

Writing a risk down is not mitigating it. The UNATTENDED sweep now reads the migration ledger and does
nothing until 0249 is applied, returning `waitingForMigration` so an empty run can never be read as
"nothing needed doing". An unreadable ledger also declines - spending money on an irreversible write while
unsure is worse than waiting an hour. The on-open path is untouched: a rep triggering recovery is a human
choosing to have their words back now.

## Mutation testing (A30 - a guard nobody can break is not a guard)
Each guard was broken in source and the NAMED test watched to fail, then the source restored and confirmed
byte-identical with `diff`.

    M1  blank is NOT recoverable          -> x accepts a BLANK transcript - the nine-session production failure
    M2  canonical guard removed           -> x REFUSES a two-sided transcript - canonical speech is never clobbered
    M3  an unassigned cluster -> "agent"  -> x labels UNKNOWN when no cluster was assigned
    M4  a decline may overwrite anything  -> x REFUSES to overwrite real agent speech with an unlabelled re-read
    MA  an unknown time becomes zero      -> x an unknown time is never a zero
    MB  an empty transcript is askable    -> x an EMPTY transcript is not asked about
    MC  a negative offset is accepted     -> x a NEGATIVE offset is corrupt, not "slightly before the start"

## Gates
A38 first, because it applies to me here and the honest answer is not the flattering one.

**THE CANONICAL GATE DOES NOT EXIT 0 ON THIS MACHINE, and I am reporting that rather than the
subset that looked better.**

    npm run check exit: 1     (run twice)
      run 1:  Test Files 626 passed | 1 skipped (627) · Tests 4159 passed | 15 skipped · Errors 10 errors
      run 2:  Test Files   1 failed | 625 passed | 1 skipped (627) · Tests 1 failed | 4138 passed · Errors 10 errors

The 10 errors are `[vitest-pool]: Timeout starting forks runner` — the worker pool failing to start
under load, not an assertion. Run 2's single failure is
`src/app/api/schedule/timeoff > returns the derived time off with the staff member's name`,
`Error: Test timed out in 5000ms`. Three things say it is the machine and not this build:

  - the file is `src/app/api/schedule/timeoff` and has nothing to do with transcripts;
  - the outcome CHANGED between two consecutive runs of the same tree (0 failures, then 1);
  - run in isolation it passes — `npx vitest run src/app/api/schedule/timeoff/__tests__/route.test.ts`
    -> `Test Files 1 passed (1) · Tests 6 passed (6) · isolated exit: 0`.

That is evidence, not proof. **`npm run check` has not been observed exiting 0 for this build, and no
sentence here should be read as saying it has.** It needs re-running on CI or a quieter machine before
this is called shipped.

The individual commands, each run to completion with its own exit code:

    npx tsc --noEmit                      tsc exit: 0
    npx vitest run (the two changed suites, 30 tests)   vitest exit: 0
    npm run lint                          no output, exit 0
    npm run invariant:audit               Violations: 0  (1016 files, 38 documented exceptions)
    npm run rls:audit                     Tables without RLS: 0 · Tenant-pin risks: 0
    npm run test                          Test Files 636 passed | 1 skipped · Tests 4213 passed | 15 skipped
    node tools/gate.mjs (app)             G1-G4 PASS · G5 NOT RUN
    npm test (app)                        pass 1239 · fail 0

Two invariants in the audit apply directly to the new cron and reported 0 violations on it: *every cron
route registered in vercel.json (no silently-dead cron)* and *every LLM/transcription route exports
maxDuration (no prod timeout)*.

## What is NOT verified
The recovery has not been run against production audio. Every number in think.md is a real read of the
production database, and every gate above is a real exit code, but **no dropped session has actually been
recovered yet** - that happens when this deploys and the cron fires. Until then the claim is "the path
exists and is proven in test", not "the nine are fixed". G5, the real-device runtime audit, has still
never been run on this app.
