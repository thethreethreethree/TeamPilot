---
started_at: 2026-09-10T16:00:00+08:00
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK - no recording with speech in it is left without a transcript

## Why (the record)
The founder, 2026-09-10, after a two-minute test recording, holding a coach reply that said the thread
came through empty: *"fix this now this is a major system design failure"*, then *"there should be 0% why
any recording that has valid audio(people speaking) should not have any transcript!!"*, then the audit
instruction this build answers: *"please audit the system to make sure that ALL sessions with audible
person/persons speaking create a transcript and be able to be processed and utilize by our system for the
features that currently exist in our system"*.

And, mid-build, the sentence that set this build's scope: *"make sure that we create a system that resolve
the drop sessions and session without a script. this is a major focus right now"*. Not only stop making
new ones - RESOLVE the ones already sitting there.

## What was measured before anything was designed
Read from production with the service role on 10 September, bucketing every session by (audio present) x
(transcript state). The first run used the wrong table name and reported nothing; the numbers below are
from the corrected run against `coaching_transcript_segments`.

    sessions total ............................... 363
    transcript segments total .................... 2268

    WITH saved audio
      audio + NO transcript ...................... 9     <- the dropped ones
      audio + one-sided .......................... 1
      audio + two-sided .......................... 6
    WITHOUT saved audio
      no audio + transcript ...................... 166   (live-coaching path)
      no audio + none ............................ 181

Nine, not the thirteen an earlier estimate had carried. The oldest is from 25 July; the newest is the
founder's own 149-second test from 07:52 that morning. **Every one of the nine had
`auto_recover_attempted_at = null`.** Nothing had ever tried to fix any of them.

## Understanding
The nine are not a transcription failure. The audio reached the server, was stored, and had its true
duration stamped from the transcription's own word timestamps - so the words EXISTED and were thrown away
after being counted. What was missing was a path that would accept them.

Two recovery directions already existed, and the gap is that neither owned this case:

  - `/auto-recover` keys on the talk_ratio CAVEAT (`captureGap` "customer-missing"): the agent side was
    captured, the customer side was not. `computeTalkRatio` of an EMPTY transcript returns null, so the
    route answered "not-applicable" and stopped. Its own comment deferred the empty case onward.
  - the case it deferred to is `captureGap` "agent-missing", owned by the MANUAL one-tap card on the web
    After-Pitch page, which needs a human to open the call and tap.

The nine were recorded on the phone. The phone has no such card. **So a mobile call that came back blank
had no recovery path at all - automatic or manual - and the system was silent about it.**

There is a second half to the founder's sentence that is easy to skip: "and be able to be PROCESSED AND
UTILIZE by our system for the features that currently exist". A swept inventory of the consumers says why
that half is not free - every coaching engine filters on `speaker === "agent"`:

    afterPitch.ts:146 · salesDissect.ts:59,166 · salesReview.ts:67 · processBreakdown.ts:68 ·
    salesMomentsPrompt · salesPivotPrompt · salesIntelPrompt · liveCuePrompt · pitchSeparation.ts:256,311

So a transcript saved as `unknown` satisfies "0% lost" and fails "usable". Storing the words is half the
instruction. §1.5.4 is the clause that forbids calling that done: the founder named the OUTCOME as the
deliverable, so it binds at layer 2 and is not waivable as later polish.

## The decision that was the founder's, and their answer
Two forks were put to them rather than taken quietly:

  - **What triggers recovery?** -> *sweep + on-open*. On-open alone only ever reaches calls somebody
    reopens, and a rep has no reason to reopen a call that showed them nothing.
  - **When the system cannot tell which voice is the rep?** -> *save unlabelled, then ask*. Not "guess
    from the words", which would put a fabricated speaker under every coaching score.

## Ripple (1.5)
- A recovered transcript is written by the ATOMIC replace RPC. Pre-0249 that RPC ignores `spokenAt` and
  writes NULL, so the timing this build creates is lost until **0249 is applied**. Named in closure.
- The rep's ANSWER also goes through `/label-transcript`, which rebuilds `spoken_at` from the offsets in
  its payload. A naive answer sends none - so answering the question would have DESTROYED the timing the
  recovery had just created. That is why the app rebuilds the offsets from `spoken_at` rather than
  omitting them.
- `recording-purge-cron` keeps each rep's 20 most recent recordings. A dropped call is therefore on a
  clock: once its audio is purged the words are gone permanently. That is why the sweep drains OLDEST
  FIRST. Currently 16 sessions hold audio, under the 20 ceiling, so nothing is at the edge yet.

## Session-Reads (A22)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-09-10T16:52:00+08:00",
    "why_it_governs": "Understanding precedes solving; if you cannot say WHY the problem exists you are not permitted to fix it yet.",
    "how_this_build_will_embody_it": "The nine were not fixed until the reason no path accepted them was traced to a precondition - computeTalkRatio returning null for an empty transcript - rather than assumed to be a transcription failure." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-09-10T16:52:00+08:00",
    "why_it_governs": "The methodology defining understanding must be in the working tree and read now, not cited from cached labels.",
    "how_this_build_will_embody_it": "Every clause in this block was opened in this session after this build's started_at; none is carried from earlier in the conversation." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-137", "read_at": "2026-09-10T16:53:00+08:00",
    "why_it_governs": "Four layers in order - broken effectivity (2) is not survivable by composition (3) or polish (4).",
    "how_this_build_will_embody_it": "Layer 2 is the whole build: the feature had to actually deliver an end-to-end result for a real rep, which is why saving the words was not treated as completion when no engine could read them." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-172", "read_at": "2026-09-10T16:53:00+08:00",
    "why_it_governs": "Audit the adjacent surfaces proactively, not only the one you were asked about; a bug rarely lives alone.",
    "how_this_build_will_embody_it": "The adjacent surface was the rep's ANSWER path, and looking at it found F4 - labelling would have destroyed the timing the recovery had just written. Nobody asked about that path." },
  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "198-227", "read_at": "2026-09-10T16:28:00+08:00",
    "why_it_governs": "A result the user specified is layer 2, never waivable layer-4 polish; shipping without it and reporting done is forbidden.",
    "how_this_build_will_embody_it": "The founder specified 'be able to be processed and utilize by our system'. Storing unknown words would have met the 0% half and failed the specified result, so the question the rep can answer was built too." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-375", "read_at": "2026-09-10T16:28:00+08:00",
    "why_it_governs": "Honesty is the moat - never claim a behaviour or a completeness the data does not support.",
    "how_this_build_will_embody_it": "An undecidable recording generates NO coaching artifacts rather than a verdict from unattributed speech; the sweep reports `bounded` rather than implying a cleared backlog; and check.md states plainly that nothing has been recovered yet." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-454", "read_at": "2026-09-10T16:54:00+08:00",
    "why_it_governs": "Item 0 - a decision that is the founder's must reach them as a picker with a recommendation, never prose ending in a question.",
    "how_this_build_will_embody_it": "Both forks - what triggers recovery, and what to do when the voice cannot be identified - went to the founder as pickers with the recommendation first, before any of this was written." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-466", "read_at": "2026-09-10T16:55:00+08:00",
    "why_it_governs": "Labels propagate through commits and comments far faster than content propagates through reading; citing a clause you did not open is the failure itself.",
    "how_this_build_will_embody_it": "The line_range for this entry was corrected from the stale 466-471 the previous build carried, because the section was actually opened and found at 455." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-607", "read_at": "2026-09-10T16:28:00+08:00",
    "why_it_governs": "A22 is A19 one altitude up: the agent knows the rule and cites without reading anyway, because citing is fast and reading is slow.",
    "how_this_build_will_embody_it": "Every read_at here postdates started_at, and the minimum set was read in full when the gate named it rather than filled in from the previous build's block." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-789", "read_at": "2026-09-10T16:28:00+08:00",
    "why_it_governs": "A fix that lives in prose has a half-life equal to how long the author remembers it; the boundary of a class is the gate, not the last instance.",
    "how_this_build_will_embody_it": "The durable defense is the sweep's own candidate query - audio present AND no usable transcript - which repairs a future path that stores audio without transcribing it, without that path's author knowing this exists." },
  { "id": "§3.5", "source_file": "CLAUDE.md", "line_range": "376-386", "read_at": "2026-09-10T17:12:00+08:00",
    "why_it_governs": "Measure downstream consequence, never the system's own agreement with itself - measuring agreement is grading your own homework.",
    "how_this_build_will_embody_it": "The recovery stamps `audio_duration_seconds` from the transcription's own word timestamps rather than from what the client claimed the recording was, so the length is a measurement and not a self-report." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-428", "read_at": "2026-09-10T17:12:00+08:00",
    "why_it_governs": "The biggest risk is the builder under pressure, and the temptation is to make the method less honest for a faster result.",
    "how_this_build_will_embody_it": "Under an explicit 'major focus right now', the pressure was to report the nine fixed. check.md says instead that nothing has been recovered yet and that the canonical gate has not been observed exiting 0. The sweep's per-run cap is the same principle applied to cost." },
  { "id": "A21", "source_file": "ThinkerThinker.md", "line_range": "530-537", "read_at": "2026-09-10T17:13:00+08:00",
    "why_it_governs": "An audit that looks WITHIN a module and not ACROSS them misses 'same name, different feature' - two surfaces that share a label and do different things.",
    "how_this_build_will_embody_it": "It is exactly what was found: 'recovery' named two different features - an automatic one for a missing customer side, and a manual web-only one for everything else - and the phone had neither. Looking within either route would never have shown it." },
  { "id": "A36", "source_file": "ThinkerThinker.md", "line_range": "923-933", "read_at": "2026-09-10T17:02:00+08:00",
    "why_it_governs": "Open the residual you are MOST sure does not matter; certainty is where the undiscovered defect hides.",
    "how_this_build_will_embody_it": "R4 was marked high-confidence-irrelevant and opened anyway. It was wrong twice, and the second error was a cost loop in code I had written ninety minutes earlier (F6)." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1022", "read_at": "2026-09-10T16:29:00+08:00",
    "why_it_governs": "Verified is a claim about a COMMAND you ran; a scoped substitute reads identically to the canonical gate and is not the same statement.",
    "how_this_build_will_embody_it": "check.md pastes `npm run check` by name with its exit code, alongside the targeted suites rather than in place of them." }
]
```
