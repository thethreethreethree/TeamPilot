---
started_at: 2026-08-23T07:40:00+08:00
---

# THINK — DoorLog iOS zero-audio fix (data-led: AudioContext conflict + explicit mimeType + honest content-type)

The capture instrumentation paid off: `scripts/diag-capture-failures.mjs` shows **3 real `doorlog.capture_failed`
events, all iOS Safari**, meaningful durations (51/92/203s), all classified **"no data — the mic delivered
nothing"**: `sawData=false` while the **mic track stayed live** (no ended/mute), the **recorder did not error**,
and the **wake-lock WAS granted**. So it is NOT screen-lock / DND / backgrounding / a recorder crash. The
MediaRecorder ran for minutes on iOS Safari and received zero audio. This is a DATA-LED diagnosis, not an
assumption ([[feedback_recurring_failure_instrument_dont_assume]]) — founder directed "do all of these".

## The fix (§1.2 from the data · §1.5 holistic across the pipeline)

Three coordinated changes, all low-DOWNSIDE (iOS is currently 100% broken here, so an iOS-path change can only
improve it; the webm pipeline for other browsers is unchanged):

1. **AudioContext/mic-sharing conflict** — the leading, evidence-fitting cause. `arm()` built the sound-bar
   analyser via `createMediaStreamSource(stream)` on the SAME stream MediaRecorder records; iOS Safari's
   AudioContext can consume that stream's audio, leaving the recorder silent. Fix: run the analyser on a CLONED
   mic track, so MediaRecorder gets the untouched stream. Falls back to the original if clone is unavailable.
2. **Explicit supported mimeType** — `pickSupportedMimeType()` selects the first `isTypeSupported` of
   webm→mp4→aac. Prefers webm (non-iOS unchanged); iOS resolves to `audio/mp4` (what it already defaults to).
   Being explicit + verified avoids a silent no-data start on a codec the browser can't encode.
3. **Honest stitched content-type** — `stitchPitchAudio` hardcoded `audio/webm` on the merged recording, so once
   iOS produces data (mp4) the worker would hand mp4 bytes to STT labeled webm. Now it preserves the chunks'
   ACTUAL content-type (iOS records mp4; short iOS pitches already transcribed fine, so ElevenLabs tolerates it).

Data-gathering continues (the third "do all"): the diag stays; after deploy I re-check whether iOS events stop.

## Scope + ripple (§1.5.1 layer-2, §1.5.2)
Scoped to DoorLog (where the data is). The live + meeting recorders share the AudioContext-on-mic pattern, BUT
theirs feeds Scribe STT (load-bearing — can't be cloned away the same way); they're now instrumented
(`coach.capture_failed`), so if they show the same iOS no-data signature the fix is data-led there too — flagged,
not blindly applied. The chunked-mp4 stitch (do iOS mp4 fragments concatenate cleanly?) is the one thing only a
device confirms; iOS being already-broken bounds the downside, and the single-blob fallback + ElevenLabs mp4
support cover the common case.

## Honesty (§0, §3.4)
The AudioContext-conflict is the LEADING hypothesis the data fits, not a certainty — this is why the diag stays
and a device test confirms. No cause is over-claimed; the changes are the safest set that addresses the evidence.

## Session-read manifest (A22)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-23T07:44:06+08:00",
    "why_it_governs": "Understand before solving — the fix follows from real events, and names the AudioContext conflict as a hypothesis, not a certainty.",
    "how_this_build_will_embody_it": "Diag-derived diagnosis; the diag stays + a device test confirms; no over-claim." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-08-23T07:44:06+08:00",
    "why_it_governs": "Methodology in the working tree, read this session.",
    "how_this_build_will_embody_it": "Re-opened the cited CLAUDE §§ + axioms via Read this session." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-59", "read_at": "2026-08-23T07:44:06+08:00",
    "why_it_governs": "Retrospective — the fix is driven by the actual recorded events, not a forward theory.",
    "how_this_build_will_embody_it": "diag-capture-failures over the real doorlog.capture_failed events set the direction." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-73", "read_at": "2026-08-23T07:44:06+08:00",
    "why_it_governs": "Holistic — a client mimeType change ripples to the server stitch + transcription.",
    "how_this_build_will_embody_it": "Fixed the stitch content-type alongside the client mimeType so mp4 isn't mislabeled to STT." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-138", "read_at": "2026-08-23T07:44:06+08:00",
    "why_it_governs": "Layer-2 — capturing the pitch audio is the feature's job; iOS delivering zero audio fails it outright.",
    "how_this_build_will_embody_it": "Removes the AudioContext starvation so the iOS recorder actually captures." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-170", "read_at": "2026-08-23T07:44:06+08:00",
    "why_it_governs": "Proactive audit — checked whether the same pattern affects the other recorders.",
    "how_this_build_will_embody_it": "Flagged live/meeting (STT-load-bearing AudioContext); they're instrumented to reveal it, not blind-fixed." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-388", "read_at": "2026-08-23T07:44:06+08:00",
    "why_it_governs": "Honesty — don't over-claim the cause; label the recording's real format to STT.",
    "how_this_build_will_embody_it": "Leading-hypothesis framing + the honest content-type fix; diag stays to confirm." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-455", "read_at": "2026-08-23T07:44:06+08:00",
    "why_it_governs": "The quick-decision checklist gates any substantive action.",
    "how_this_build_will_embody_it": "Ran it: diagnosed from data, traced the pipeline ripple, scoped to iOS (low-downside), kept the diag." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-477", "read_at": "2026-08-23T07:44:06+08:00",
    "why_it_governs": "Methodology in the working tree, read this session.",
    "how_this_build_will_embody_it": "Re-opened the cited axioms via Read this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-633", "read_at": "2026-08-23T07:44:06+08:00",
    "why_it_governs": "Citations need an in-session read.",
    "how_this_build_will_embody_it": "Each cited asset carries a current in-session read_at." },
  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-710", "read_at": "2026-08-23T07:44:06+08:00",
    "why_it_governs": "A reported bug is one instance of a class; sweep the boundary.",
    "how_this_build_will_embody_it": "Fixed DoorLog; flagged live/meeting as the same AudioContext-on-mic shape (STT-load-bearing), instrumented to confirm." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-790", "read_at": "2026-08-23T07:44:06+08:00",
    "why_it_governs": "Encode the lesson in a gate — a prose fix returns.",
    "how_this_build_will_embody_it": "The diag script (shipped) is the standing gate that surfaces recurrence per surface + device." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1023", "read_at": "2026-08-23T07:44:06+08:00",
    "why_it_governs": "'Verified' names the command you ran.",
    "how_this_build_will_embody_it": "check.md carries the full `npm run check` exit-0 output + the exact test count." }
]
```
