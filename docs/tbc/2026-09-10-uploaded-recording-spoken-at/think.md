---
started_at: 2026-09-10T11:20:00+08:00
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK - an uploaded recording has never had a spoken_at, so the pace skill has never worked

## Why (the record)
The native app's REV1 spec doc 04 says the "speed" skill "showed 'not enough sessions yet' forever, because the
per-turn timing it needs was never captured", and instructs the APP to stamp `spokenAt` per turn. Working that
doc, I traced the app's actual capture model rather than accepting the doc's premise, and the premise is wrong
for the app: the native app does not transcribe. It uploads audio and the SERVER diarizes. The app posts no
transcript segments at all - it only reads them.

So I followed the server chain instead, one hop at a time:

1. `transcribeWithDiarization` (`lib/care/voice/elevenlabs.ts`) builds each segment as
   `{ speakerId, text, start }` - `start` being seconds into the audio, from the provider's per-word timestamps.
2. `buildSpeakerResponse` (`.../upload-recording/route.ts`) types its input as `{ speakerId, text }` and
   returns `{ speakerId, text, seq }`. **The offset is dropped here.**
3. `label-transcript` accepts `{ speakerId, text, seq }` and calls `appendTranscriptSegment` with no
   `spokenAt`, so every row lands with `spoken_at = null`.
4. `agentWpm` (`lib/coach/v5/skillAnalytics.ts`) needs at least three CLEAN TIMED agent turns and returns null
   otherwise; `speedScore` therefore never scores.

That is a complete chain from a value that exists to a skill that cannot see it, and it is not an app problem:
**every uploaded recording has a blank pace skill, from the web as well as the app.** The live-coaching path is
unaffected - it stamps `spokenAt` from the browser as each utterance is captured.

## Understanding
The timing was never missing. It was dropped at one boundary, and the drop was invisible because nothing fails:
the upload succeeds, the transcript is correct, the label succeeds, and the skill quietly says "not enough
sessions yet" - which is also what it says to a rep who genuinely has too few sessions. The two are
indistinguishable from outside, which is why this survived.

The offsets are relative to the start of the audio; `spoken_at` is a wall clock. They join at the session's own
`started_at`. `agentWpm` measures each turn as the GAP TO THE NEXT timed segment, so a base a few seconds early
or late shifts every stamp equally and changes no gap and no score - the base only has to be honest enough for
the clock shown beside a transcript line, which `started_at` is.

The one thing that must NOT happen is stamping an unknown offset with the base. That would make the next turn's
gap measure from a time nobody spoke at - a wrong pace on a skill whose entire claim is that it is measured.
Unknown stays null.

## Ripple (1.5)
- `buildSpeakerResponse` gains `startSeconds` in its response. Additive: an older client ignores it.
- `label-transcript`'s schema gains an OPTIONAL `startSeconds`. It must stay optional - an app build already on
  a phone, or a browser tab open since before the deploy, still labels successfully and simply gets no pace.
- `replaceSessionTranscript` (the recovery re-transcribe path) forwards `spokenAt` to the RPC. The pre-0249 RPC
  selects a literal null and ignores every other key, so a deploy-before-migrate loses the TIMING, never the
  transcript.
- Migration 0249 is `create or replace` on `replace_session_transcript`, idempotent by construction, and a
  payload without `spokenAt` still yields null - identical to 0212's behaviour.
- The native app carries the field through unchanged; the app-side commit makes that explicit rather than
  accidental and pins it with a test.

## Session-Reads (A22)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-09-10T11:25:00+08:00",
    "why_it_governs": "Understanding precedes solving - the spec doc named the app as the fix site and was wrong; the chain had to be walked before anything was written.",
    "how_this_build_will_embody_it": "Traced diarizer -> upload-recording -> label-transcript -> agentWpm one hop at a time and found the drop, instead of stamping timestamps in the app as instructed." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-09-10T11:31:00+08:00",
    "why_it_governs": "The methodology defining understanding must be in the working tree and read now, not recalled.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md are in this repo; every clause below was opened in this session and its hashes are pinned in the front matter." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-76", "read_at": "2026-09-10T11:31:00+08:00",
    "why_it_governs": "Holistic - never fix one thing in a way that silently breaks another; trace the ripple first.",
    "how_this_build_will_embody_it": "The ripple above names every consumer of the changed shapes, including the deploy window where 0249 is not yet applied." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-137", "read_at": "2026-09-10T11:32:00+08:00",
    "why_it_governs": "Layer 2 is whether the feature delivers the intended result when invoked for real, not whether a unit test passes.",
    "how_this_build_will_embody_it": "The skill is scored server-side from stored rows, so layer 2 is what appendTranscriptSegment actually RECEIVES - which is what the route test asserts. The one branch still unproven end to end (the recovery replace) is named as a residual rather than claimed." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-172", "read_at": "2026-09-10T11:32:00+08:00",
    "why_it_governs": "THINK first about what could be wrong, then search to confirm - and audit the adjacent surface.",
    "how_this_build_will_embody_it": "The hypothesis (the app cannot be the capture client) came before the grep, and the adjacent read - salesMoments and salesPivot, which also key off spoken_at - was checked and is recorded in the ripple." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-375", "read_at": "2026-09-10T11:26:00+08:00",
    "why_it_governs": "Honesty is the moat - an unknown must not be dressed as a measurement.",
    "how_this_build_will_embody_it": "A segment with no offset stays spoken_at null; it is never stamped with the start of the call to make the data look complete." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-454", "read_at": "2026-09-10T11:33:00+08:00",
    "why_it_governs": "Item 0 - a choice among courses goes to the founder as a picker with a recommendation, never as prose.",
    "how_this_build_will_embody_it": "How far to take this fix (server plus app, app only, or write-up only) was put to the founder as a picker with the recommendation first; this build is the option they chose." },
  { "id": "A14", "source_file": "ThinkerThinker.md", "line_range": "335-354", "read_at": "2026-09-10T11:27:00+08:00",
    "why_it_governs": "Data path complete is not the same fact as render path complete.",
    "how_this_build_will_embody_it": "The route test asserts what appendTranscriptSegment actually RECEIVES, not that a field was typed; the residual names the one branch that is plumbed but unproven." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-468", "read_at": "2026-09-10T11:34:00+08:00",
    "why_it_governs": "Citing a label without the content is operating in the language of the discipline while violating it.",
    "how_this_build_will_embody_it": "Every id in this manifest was opened in this session; none is cited from memory of what it says." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-607", "read_at": "2026-09-10T11:34:00+08:00",
    "why_it_governs": "The manifest is the artifact that closes the gap between citing at the speed of language and reading at the speed of attention.",
    "how_this_build_will_embody_it": "Each entry carries an in-session read_at that postdates this build's started_at." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-789", "read_at": "2026-09-10T11:35:00+08:00",
    "why_it_governs": "A fix is not finished until the class is encoded in something that fails without the author's cooperation.",
    "how_this_build_will_embody_it": "The drop is now pinned by named tests at both ends, and the pin was proven by mutation rather than assumed - see check.md." },
  { "id": "A34", "source_file": "ThinkerThinker.md", "line_range": "872-895", "read_at": "2026-09-10T11:28:00+08:00",
    "why_it_governs": "Code that hard-requires an unapplied migration is an outage with a timer.",
    "how_this_build_will_embody_it": "The RPC caller sends spokenAt unconditionally because the PRE-0249 function ignores unknown keys - so a deploy before 0249 loses timing, never a transcript. No code asserts 0249 is applied." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1022", "read_at": "2026-09-10T11:29:00+08:00",
    "why_it_governs": "Verified is a claim about a command you ran, by its own name.",
    "how_this_build_will_embody_it": "check.md pastes npm run check by name with its exit code, plus the targeted suite and the mutation run." }
]
```
