---
started_at: 2026-08-22T07:46:00+08:00
---

# THINK — Get the recording fix TO the field + honest "no audio" copy

Two things surfaced while shipping the chunked-upload fix, both confirmed by live field screenshots + data.

## Problem 1 — the fix wasn't reaching actively-knocking reps

A rep 25 doors into a session showed the amber "recorded no audio" notice at 7:26; the chunked fix deployed at
~7:29. The live DB confirmed it: **19 knocks but 0 pitches in the last 90 min** — the field was on a stale bundle
and every recording was failing + falling back to a knock. Root: `VersionWatcher` force-updates on reopen, on
90s of idle, or on a manual banner tap — but an **actively-knocking mobile rep never idles 90s and never
backgrounds the app**, so a deploy sits unreceived for hours. The fix is invisible to exactly the people who need
it.

**Fix:** DoorLog now (a) marks a recording in progress via `document.body.dataset.recording` — the SAME flag
VersionWatcher already guards on — so it can never auto-reload mid-pitch; and (b) dispatches a
`elostate:safe-to-update` event when it returns to IDLE after a door (between doors, nothing recording).
VersionWatcher listens for it and does a fresh check + auto-reload IF stale (its recording-guard + once-per-commit
loop-guard still apply). So a stale rep updates at the next door gap, not hours later.

## Problem 2 — "recorded no audio" is a lie when the upload failed (audit M1)

The founder caught the amber notice saying "recorded no audio" for a pitch the rep DID record — the recording
failed to UPLOAD, it wasn't absent. §3.4 honesty: the message asserts something false about what the rep did.

**Fix:** `sendPitch` now returns WHY audio dropped — `upload_failed` (a blob/chunks existed → the rep recorded,
we couldn't save it: "the recording couldn't be saved this time (weak signal)") vs `no_capture` (nothing was
captured → "no audio was recorded"). The note tells the truth about the cause.

## Session-read manifest (A22)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-22T07:47:44+08:00",
    "why_it_governs": "Understanding precedes solving — the 0-pitches/19-knocks record diagnosed 'fix not received', not a new bug.",
    "how_this_build_will_embody_it": "The reach fix targets the proven cause (active reps don't auto-update)." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-40", "read_at": "2026-08-22T07:47:44+08:00",
    "why_it_governs": "Methodology in the tree, read this session.",
    "how_this_build_will_embody_it": "Re-read A19/A22/A38 via Read this turn (07:47)." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-138", "read_at": "2026-08-22T07:47:44+08:00",
    "why_it_governs": "Layer-2 — a fix the field never receives has not delivered its result.",
    "how_this_build_will_embody_it": "The reach fix makes the shipped recording fix actually reach active reps." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-170", "read_at": "2026-08-22T07:47:44+08:00",
    "why_it_governs": "Proactive audit — the deploy-reach gap and the misattributed copy were both caught from field signals.",
    "how_this_build_will_embody_it": "Fixed both in one pass — reach + honest copy." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "327-347", "read_at": "2026-08-22T07:47:44+08:00",
    "why_it_governs": "Honesty — 'recorded no audio' for an upload failure asserts a falsehood about the rep.",
    "how_this_build_will_embody_it": "The note distinguishes upload_failed from no_capture and states the true cause." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-460", "read_at": "2026-08-22T07:47:44+08:00",
    "why_it_governs": "The quick-decision checklist gates any substantive action.",
    "how_this_build_will_embody_it": "Ran it: proved the reach gap from the DB, reused the VersionWatcher guard, traced ripple." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-477", "read_at": "2026-08-22T07:47:44+08:00",
    "why_it_governs": "Methodology read in-session, not cached labels.",
    "how_this_build_will_embody_it": "Re-opened the cited axioms via Read this turn." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-633", "read_at": "2026-08-22T07:47:44+08:00",
    "why_it_governs": "Citations need an in-session read.",
    "how_this_build_will_embody_it": "Every cited asset carries a current in-session read_at." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-790", "read_at": "2026-08-22T07:47:44+08:00",
    "why_it_governs": "Encode the lesson in a gate.",
    "how_this_build_will_embody_it": "A render test locks the upload-failed vs no_capture copy so the misattribution can't return." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1023", "read_at": "2026-08-22T07:47:44+08:00",
    "why_it_governs": "'Verified' names the canonical command you ran.",
    "how_this_build_will_embody_it": "Ran the full npm run check; the on-device reach confirmation is stated, not assumed." }
]
```
