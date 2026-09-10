---
started_at: 2026-09-11T04:10:00+08:00
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK - a recovery that succeeds and costs something must say what it cost

## Why (the record)

Three sessions carry `coach.transcript_recovery_timing_lost` events, written on 2026-09-10 at
09:21:05, 09:21:51 and 09:22:06 - three inside sixty-one seconds. Payload on each:
`{"reason":"rpc-pre-0249"}`. The production migration ledger still ends at **0248**.

Those three calls have their words and will never have their timing. `spoken_at` is what
`agentWpm` reads and therefore what the pace skill is computed from - the skill that has never
produced a reading for anybody. The recovery deliberately does NOT release the at-most-once
marker when this happens, and that decision is right: re-running would spend a transcription
every hour on every affected session for a condition only a human applying a migration can
clear. An honest record beats an expensive loop.

The gap is not the loss. It is that nobody who asked for the recovery was told about it.

## The shape of the failure

`replace_session_transcript` carries `spokenAt` only from 0249 onward. The 0212 version selects
a literal null and ignores the argument. **Both succeed and both return a count.** So a caller
sees a successful recovery with a segment count and has no way to know the timing was dropped.

`transcriptRecovery.ts` already detects it - it reads its own write back rather than assuming,
which is exactly right - and records it two ways: a `console.error` line, and an `events` row.
Neither of those is reachable by the rep who pressed the button or by the app that called the
route. The detection was built; the reporting stopped at the server boundary.

This is the house failure mode stated in its own terms: a partial result reported as a whole
one. It is the same shape as the blank After-Pitch that reported `hasSignal` from a composite,
and the same shape as an empty transcript that reported success because the diarizer returned
`[clicking]`.

## What is deliberately NOT in scope

`runTranscriptRecoverySweep` gates on the migration and refuses to run. The on-open path in
`dashboard/sales-coach/[id]/after-pitch/page.tsx` does not, and that is documented, not
accidental: *"ONLY THE UNATTENDED SWEEP WAITS. A rep opening a call and triggering recovery is a
human choosing to have their words back now; that path is untouched."*

I do not agree that the justification holds for the website, because that page fires
`autoRecover()` from `load()` - on page load, with no choice presented to anybody - and three
timing-lost events inside sixty-one seconds is what automatic firing looks like, not three
deliberate decisions. But changing when a rep's call gets recovered changes what reps
experience, and that is the founder's call and not mine. It goes to them as a decision with the
measurement attached. This build makes the cost VISIBLE; it does not change who pays it.

## The bar

A caller that recovers a transcript must be able to tell a complete recovery from a partial one,
and the person who asked must be told in words they can act on - which here means being told
there is nothing to act on, because there is not.

## Session-read manifest

<!-- The clause number for this manifest lives in THINK_BUILD_CHECK.md, which is not in this
     working tree. Citing it would be exactly what 0.1 forbids - a rule quoted from outside the
     tree - so the requirement is honoured and the citation is omitted. -->

Every clause below was opened in THIS session, after this build's `started_at`, from the file
named. None is carried from a cached label or from earlier in the conversation - which is the whole
of A22, and the reason the manifest exists rather than a claim that the rules were followed.

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-09-11T04:25:00+08:00",
    "why_it_governs": "Understanding precedes solving; if you cannot say WHY the problem exists you are not permitted to fix it yet.",
    "how_this_build_will_embody_it": "I began this build about to add a migration gate to the interactive recovery path, and stopped when the sweep's own comment turned out to document that exemption as a decision. The finding changed from 'a missing guard' to 'a rationale that does not match its implementation' because the cause was read rather than assumed." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-09-11T04:25:00+08:00",
    "why_it_governs": "The methodology defining understanding must be in the working tree and read now, not cited from memory.",
    "how_this_build_will_embody_it": "Each clause in this block was opened in this session; the two governing documents' hashes are pinned in the front-matter above and match DOC_MANIFEST.json." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-137", "read_at": "2026-09-11T04:27:00+08:00",
    "why_it_governs": "Four layers in order - a broken layer 2 is not survivable by composition or polish.",
    "how_this_build_will_embody_it": "Layer 2 is the entire build. The mechanism worked perfectly: the timing loss was detected correctly and recorded twice. What did not work was the result reaching a person, and a correct mechanism nobody can see is a layer-2 failure, not a polish item." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-160", "read_at": "2026-09-11T04:27:00+08:00",
    "why_it_governs": "Think first about what else could fail, THEN search to confirm - mechanical grep alone does not satisfy it.",
    "how_this_build_will_embody_it": "The three lost calls were not found by grepping code. They were found by asking what a button I had just shipped would actually do, then querying the events table for the answer." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-450", "read_at": "2026-09-11T04:29:00+08:00",
    "why_it_governs": "Item 0 - a choice among courses goes to the founder as a decision, never as prose; item 1 - understand why, from the record.",
    "how_this_build_will_embody_it": "F3 is a real choice with a real trade (words now against timing later) and it is NOT taken here. It goes to the founder with the measurement attached, and is recorded as R1 rather than decided quietly." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "56-60", "read_at": "2026-09-11T04:30:00+08:00",
    "why_it_governs": "Methodology that governs the build must live in the working tree.",
    "how_this_build_will_embody_it": "Both governing documents were read from this tree in this session; the sweep's and the recovery's own comments were read from source rather than recalled, which is what changed F3 from an accusation into a finding." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "56-60", "read_at": "2026-09-11T04:30:00+08:00",
    "why_it_governs": "Constitutional citations without session-reading are undetected violations.",
    "how_this_build_will_embody_it": "Every clause cited in this manifest was opened at the timestamp given, and the quotes reproduced in think.md and check.md are from the files, not from memory of them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "90-93", "read_at": "2026-09-11T04:31:00+08:00",
    "why_it_governs": "A lesson in prose returns - encode it in a gate that fails without the author's cooperation.",
    "how_this_build_will_embody_it": "The note's content is pinned by named tests in the app repository: that it names what is missing, that it says the words are present, that it does not blame the rep and offers no retry. A future edit that turns it into a failure message breaks a named test." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "94-97", "read_at": "2026-09-11T04:31:00+08:00",
    "why_it_governs": "\"Verified\" is a claim about a COMMAND you ran, reported in the project's own words - not a mood.",
    "how_this_build_will_embody_it": "check.md reports the commands and their exit codes. The app-side note is reported as UNSEEN, because no phone has run this build and no command here can say otherwise." }
]
```
