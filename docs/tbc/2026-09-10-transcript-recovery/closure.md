# CLOSURE - no recording with speech in it is left without a transcript

The founder asked for 0%, and the honest report is that the number was never the hard part. Saving the
words unconditionally is a few lines. What took the build was the second half of their sentence - "and be
able to be processed and utilize by our system for the features that currently exist" - because a swept
inventory of the consumers showed every coaching engine filters on `speaker === "agent"`. A transcript
saved as `unknown` would have satisfied the first half completely and delivered nothing.

So the shape is: the words are saved the moment they exist, attribution becomes a refinement rather than a
precondition, and where the system can identify the rep from the content it does so and coaching runs with
no tap at all. Where it cannot, it saves anyway and asks - and the asking had to be built too, because the
picker was fed by a store on the device that made the recording, which is empty for a call the server
recovered weeks later.

Three things this build got wrong and had to correct in flight, all recorded in check: I measured a
confident zero from a table that does not exist and nearly wrote "16 dropped" into the record; my
refactor flattened a 500/502 distinction the route had made deliberately, and the existing test caught me;
and the rep's one tap would have destroyed the recovered timing in the act of making the call coachable -
which nothing would have caught, because there is no test for a feature quietly getting worse.

**What is not done: nothing has actually been recovered yet.** The numbers here are real production reads
and the gates are real exit codes, but no dropped session has been repaired - that happens when this
deploys and the cron first fires. Saying otherwise would be the exact failure §3.4 names.

```json
[
  { "id": "R1-migration-0249-not-applied",
    "item": "The atomic replace RPC ignores `spokenAt` until 0249 is applied, so every recovered transcript lands with NULL timing until the founder runs the migration.",
    "why_skipped": "Applying a migration to production is the founder's action, not mine, and the recovery is correct either way - it loses the timing, not the words.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null },

  { "id": "R2-two-voice-recovered-calls-cannot-be-asked-about-on-the-phone",
    "item": "The rebuilt question collapses to one voice, because a server-saved `unknown` transcript is the case where the system could not separate two. If a recovery ever saves `unknown` with two genuine clusters, the phone can only offer 'all me' or 'all customer'.",
    "why_skipped": "It cannot currently happen: an assignment that DECIDES writes real labels, and one that declines with two clusters is `ambiguous`, which on a blank transcript still writes unknown. So this is reachable, and I am recording it as reachable rather than claiming it is not.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null },

  { "id": "R3-coaching-sessions-outcome-still-zero-of-73",
    "item": "Carried forward from the daily-goal build and still unanswered: no coaching session carries an outcome, which blanks every money metric on the KPI screen.",
    "why_skipped": "Unrelated to transcripts; surfaced to the founder rather than answered inside a build about recovery.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null },

  { "id": "R4-the-nine-may-not-all-hold-speech",
    "item": "Seven of the nine dropped sessions have no `audio_duration_seconds`, so I assumed some of the nine were taps rather than calls and that the size of the loss did not need measuring.",
    "why_skipped": "I reasoned that the recovery handles silence honestly either way, and treated that as a reason not to look.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-10T16:47:00+08:00",
    "outcome": "OPENED, and it was wrong twice over. FIRST, the loss is far larger than 'some taps': HEAD requests against storage give 42.9 MB, 39.8 MB and 39.1 MB for three of the nine, against 619 KB for the founder's known 149-second call - those are hours of recorded selling that were discarded. They also belong to THREE different account prefixes, so this was never only the founder's test calls. SECOND, and this is the part that changed code: a 40 MB file is exactly what a 300-second function budget fails on, and my sweep released the at-most-once marker on any transient failure - so the largest, most valuable recordings would have been retried every hour forever, billing each time and never completing. Recorded as F6 and bounded by MAX_TRANSIENT_RETRIES. A36 again: the residual I was most certain about was the one hiding a defect I had introduced ninety minutes earlier." }
]
```
