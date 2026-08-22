---
started_at: 2026-08-23T03:31:00+08:00
---

# THINK — DoorLog capture: stop guessing why "no audio" happens; detect + warn + report the real cause

Founder P0 (2026-08-23): reps hit "recorded no audio" repeatedly. My first read blamed a stale client (the old
banner copy + the "new version available" banner). **The founder corrected me: the banner pertains to the recent
Team-Sync deploys, not this issue — and assuming staleness is the same assumption-making that caused the problem.
That correction is right, and it reframes the fix.**

## The real diagnosis (§0, §1.2 — from the code, not an assumption)

`no_capture` (the amber banner) fires when the recorder produced **literally nothing** — no chunk during recording
AND no final blob. Reading `useDoorRecorder`: it **swallows every failure signal**. There is no `MediaRecorder`
`onerror` handler; `arm()`/`start()`/`stop()` all `catch {}` silently; nothing watches the **mic track**. So when
capture yields zero audio we have **no record of why** — which is precisely why every prior fix (long-upload,
staleness) was a guess. *The blindness is the root defect.* On iOS the top cause of zero audio is the **mic track
dying mid-pitch** — screen-lock / DND / a phone call / another app grabbing the mic — and the recorder neither
detects nor reports it.

## The fix (breaks the guess-cycle + addresses the likely cause) — §3.4, §1.5.1, A30

1. **Capture ground truth** (`useDoorRecorder`): add `rec.onerror`; watch the audio track's `ended`/`mute`/`unmute`;
   record whether `ondataavailable` ever fired, the chosen `mimeType`, tab-hidden count during recording, whether
   the wake lock was actually granted, and the track's readyState at stop. `stop()` returns a `CaptureDiag`.
2. **Warn the rep LIVE** (`captureInterrupted` → DoorLog): the moment the mic track dies, show an honest in-pitch
   warning so the rep can recover the pitch (keep the screen on / bring the app forward), instead of discovering
   "no audio" afterward. This is the layer-2/3 fix — the feature's job is to capture the pitch; a dying mic that
   only surfaces after the fact fails that.
3. **Report the cause** (`POST /capture-diag` → a `doorlog.capture_failed` event, company-pinned): on any
   zero-audio outcome, the recorder's observations are appended to the event log — queryable, so the NEXT
   occurrence is diagnosed from data, never assumed. (§3.4: a failure the system can't explain is a failure dressed
   as mystery; make it legible.)
4. **Fix the misleading sound-bar on iOS**: resume the AudioContext on the Record tap (a user gesture) — a fresh
   AudioContext starts suspended on iOS Safari, so the level bar was flat even when audio WAS captured, making it
   useless as a "capture is working" signal.

Not claimed as THE cause — that would repeat the assumption. This makes the cause **observable**; the specific
follow-up fix (if track-death dominates: a louder pre-record "keep the screen on" affordance, or an audible cue)
becomes evidence-led.

## Ripple (§1.5, holistic)
Additive: the existing blob/chunk/save path is unchanged; the diag is extra return data + a best-effort POST.
`stop()` now returns `diag` — every caller/mock updated. The new endpoint mirrors the sibling `audio-chunk`
route's auth + company-pin (INV15) and appends to the existing append-only `events` table. Best-effort:
diagnostics never block or fail the rep's flow.

## Class sweep (A26 / §1.5.2)
Root shape: *"a media-capture path that discards its own failure signal, so a zero-output is unexplainable."* All
four recorders (door, live sales, meeting, C.A.R.E voice) share it — none has `onerror`/track-death detection.
This build fixes the DoorLog instance (the reported one) and RECORDS the boundary; the live/meeting/CARE recorders
are the same class, flagged for the same treatment (not done here — scoped to the reported P0, per §1.5.2 "ship the
task, file the rest").

## Session-read manifest (A22)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-23T03:31:58+08:00",
    "why_it_governs": "Understand before solving — I diagnosed the swallow-every-failure blindness from the code before building.",
    "how_this_build_will_embody_it": "The fix targets the named root (no failure signal), not another guessed cause." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-08-23T03:31:58+08:00",
    "why_it_governs": "Methodology in the working tree, read this session.",
    "how_this_build_will_embody_it": "Re-opened the cited CLAUDE §§ + axioms via Read this session." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-59", "read_at": "2026-08-23T04:05:28+08:00",
    "why_it_governs": "Retrospective — read the actual code + the founder's correction, not a forward theory.",
    "how_this_build_will_embody_it": "Dropped the staleness assumption; instrument to get the actual record of what happened." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-73", "read_at": "2026-08-23T04:05:28+08:00",
    "why_it_governs": "Holistic — trace ripple; don't break the working save path.",
    "how_this_build_will_embody_it": "Additive diag + endpoint; the blob/chunk/save path is byte-unchanged; every stop() caller updated." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-138", "read_at": "2026-08-23T04:05:28+08:00",
    "why_it_governs": "Layer-2/3 — capturing the pitch is the feature's job; a mic that dies silently defeats it.",
    "how_this_build_will_embody_it": "Live in-pitch warning lets the rep recover; the diag makes 'why' legible." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-170", "read_at": "2026-08-23T03:31:58+08:00",
    "why_it_governs": "Proactive audit — swept the capture-blindness class across all four recorders; recorded the boundary.",
    "how_this_build_will_embody_it": "Fixed the DoorLog instance; flagged the live/meeting/CARE recorders as the same class." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-388", "read_at": "2026-08-23T04:06:00+08:00",
    "why_it_governs": "Honesty is the moat — a failure the system can't explain is a failure dressed as mystery.",
    "how_this_build_will_embody_it": "Warn live + record the ground-truth cause; never silently swallow it again." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-455", "read_at": "2026-08-23T04:06:00+08:00",
    "why_it_governs": "The quick-decision checklist gates any substantive action.",
    "how_this_build_will_embody_it": "Ran it: re-diagnosed after the correction, traced ripple, swept the class, encoded gates." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-477", "read_at": "2026-08-23T03:31:58+08:00",
    "why_it_governs": "Methodology in the working tree, read this session.",
    "how_this_build_will_embody_it": "Re-opened the cited axioms via Read this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-633", "read_at": "2026-08-23T03:31:58+08:00",
    "why_it_governs": "Citations need an in-session read.",
    "how_this_build_will_embody_it": "Each cited asset carries a current in-session read_at." },
  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-710", "read_at": "2026-08-23T04:05:28+08:00",
    "why_it_governs": "A reported bug is one instance of a class; sweep the boundary.",
    "how_this_build_will_embody_it": "Named the capture-blindness class; fixed DoorLog, recorded the other three recorders as the same shape." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-790", "read_at": "2026-08-23T04:06:00+08:00",
    "why_it_governs": "Encode the lesson in a gate — a prose fix returns.",
    "how_this_build_will_embody_it": "Tests lock the endpoint gate (auth + company-pin) + the render behavior (live warning; diag POST on no-audio)." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1023", "read_at": "2026-08-23T04:06:00+08:00",
    "why_it_governs": "'Verified' names the command you ran.",
    "how_this_build_will_embody_it": "check.md carries the full `npm run check` exit-0 output + the exact test count." }
]
```
