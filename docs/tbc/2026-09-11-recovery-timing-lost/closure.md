# CLOSURE - a recovery that succeeds and costs something must say what it cost

A small build, and the smallness is the point: the hard part - detecting that the timing did not
survive, by reading the write back instead of trusting a return count - was already done, and done
well. What was missing was the few lines carrying that fact past the server boundary to the person
who asked for the recovery.

That gap had already cost three real calls. They have their words. They will not have a pace
reading, ever, because the at-most-once marker is deliberately not released and nothing will
revisit them. Every caller was told the recovery succeeded, which was true, and nothing else, which
was the failure.

The shape is the house one: a partial result reported as a whole one. It is the same shape as a
blank read reporting `hasSignal` from a composite, and the same shape as a transcript of
`[clicking]` reporting success because speech-to-text returned a string rather than an empty one.
Each time it turns up somewhere new, and each time the fix is the same - make the absence say its
own name.

## Residuals

```json
[
  { "id": "R1-the-web-still-fires-recovery-on-page-load",
    "item": "The sweep waits for migration 0249; the After-Pitch page does not. Its exemption is argued from \"a human choosing to have their words back now\", but autoRecover() is called from load(), so every rep who opens a one-sided call before 0249 is applied spends that call's timing without being asked.",
    "why_skipped": "Changing when a rep's call is recovered changes what reps experience, and the trade - words now against timing later - is the founder's to make, not mine. CLAUDE.md section 6 item 0 is explicit that a choice among courses goes to them as a decision.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-11T04:35:00+08:00",
    "outcome": "OPENED and measured rather than argued. Three coach.transcript_recovery_timing_lost events exist, at 09:21:05, 09:21:51 and 09:22:06 on 2026-09-10 - sixty-one seconds apart, which is what a page load looks like and not what three deliberate human decisions look like. The _agent_migrations ledger's newest row is 0248, so the exposure is live as this is written. It goes to the founder with those numbers attached." },

  { "id": "R2-three-calls-can-be-re-recovered-once-0249-lands",
    "item": "The three sessions named by the timing-lost events could have their at-most-once markers released and be recovered again with timing intact, once the migration is applied.",
    "why_skipped": "Nothing does this automatically and nothing should - it spends a transcription per call - and releasing a marker on production data is the founder's call. The events row exists precisely so this can be a decision later rather than a loss discovered months from now.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null },

  { "id": "R3-the-note-has-never-been-seen-by-anybody",
    "item": "The app-side note renders on a phone, and no phone has run this build. Its content is covered by named tests; its appearance is covered by nothing.",
    "why_skipped": "There is no phone or simulator in this environment, so it cannot be looked at here. It is on the device-check list rather than claimed as working.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-11T04:45:00+08:00",
    "outcome": "OPENED, and it moved from 'probably fine' to two specific things worth a human's eye. FIRST, the note renders in three separate branches of the card, and the one that matters most is the SUCCESS path - where recoveryWording() deliberately returns null, so if the note were placed only beside an outcome message it would never appear on the very case it exists for. Confirmed by reading the render: it sits directly under the 'How this call went' header, inside the branch that draws a real read. SECOND, it uses the same bounded-region idiom already used by the recovery outcome block and the Team coaching notes - a left rule, muted body text, no alert styling - so it should not read as an error. Neither of those is provable without eyes, which is exactly why this stayed open rather than being closed as covered." }
]
```
