---
started_at: 2026-08-22T12:04:00+08:00
---

# THINK — Prep-up Phase 2: the UI (Team-Sync)

Phase 2 of the approved Prep-up build (`docs/MEETING-PREPUP-DESIGN.md`). The Phase-1 data layer + routes exist;
this is the facilitator-facing screen that collects the three things the founder specified — the GOAL, the
must-discuss TOPICS, and DOCUMENTS (images with notes, text/pdf) — and autosaves them against a draft prep.

## Shape
- `MeetingPrepUp` client component: creates a draft prep on mount; a goal textarea + a must-discuss topic
  list (add/remove) that **autosave** (debounced PATCH); a document uploader that runs the Phase-1
  sign → direct-to-storage → confirm(+extract) flow, with a **note step for images** (the founder's spec — the
  coach reads the note alongside the OCR). "Start Meeting" hands the prepId to the caller (Phase 5 wires it into
  session creation).
- Page `/dashboard/meeting-coach/prep` renders it; "Start Meeting" → the live coach with the prepId.
- Theme-token styled + mobile-first (works the same on web + mobile webapp); uploads are direct-to-storage so a
  large doc never hits the body cap.

## Verification honesty
Render tests prove the WIRING (draft-create on mount, topic add + autosave PATCH, upload sign→confirm lists the
doc). VISUAL verification (layout on a real phone) happens at go-live once deployed — flagged, not claimed.

## Session-read manifest (A22)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-22T12:05:30+08:00",
    "why_it_governs": "Understanding precedes solving — the UI matches the approved design + the Phase-1 contract.",
    "how_this_build_will_embody_it": "The form calls the exact Phase-1 routes; no new server contract invented." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-40", "read_at": "2026-08-22T12:05:30+08:00",
    "why_it_governs": "Methodology in the tree, read this session.",
    "how_this_build_will_embody_it": "Re-read A19/A22/A38 via Read this turn (12:05)." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-138", "read_at": "2026-08-22T12:05:30+08:00",
    "why_it_governs": "Layer-3/4 — workflow continuity + a clear surface; the screen must flow into the meeting.",
    "how_this_build_will_embody_it": "Autosave (no lost input) + a single Start Meeting that carries the prep forward." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-170", "read_at": "2026-08-22T12:05:30+08:00",
    "why_it_governs": "Proactive audit — honest upload errors, a note step for images, autosave-failure not silent.",
    "how_this_build_will_embody_it": "Upload errors surface; a failed save reschedules; the file input is type-limited." },
  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "191-215", "read_at": "2026-08-22T12:05:30+08:00",
    "why_it_governs": "A user-specified experience is layer-2 — the founder specified uploads-with-notes/goal/topics.",
    "how_this_build_will_embody_it": "All three specified inputs are present, images get the note step the founder named." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-460", "read_at": "2026-08-22T12:05:30+08:00",
    "why_it_governs": "The quick-decision checklist gates any substantive action.",
    "how_this_build_will_embody_it": "Ran it: matched the design, reused Phase-1 routes, stated the visual-verify limit." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-477", "read_at": "2026-08-22T12:05:30+08:00",
    "why_it_governs": "Methodology read in-session, not cached labels.",
    "how_this_build_will_embody_it": "Re-opened the cited axioms via Read this turn." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-633", "read_at": "2026-08-22T12:05:30+08:00",
    "why_it_governs": "Citations need an in-session read.",
    "how_this_build_will_embody_it": "Every cited asset carries a current in-session read_at." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-790", "read_at": "2026-08-22T12:05:30+08:00",
    "why_it_governs": "Encode the lesson in a gate.",
    "how_this_build_will_embody_it": "Render tests lock draft-create, topic autosave, and the upload sign→confirm flow." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1023", "read_at": "2026-08-22T12:05:30+08:00",
    "why_it_governs": "'Verified' names the command you ran — and its honest limit (visual verify at go-live).",
    "how_this_build_will_embody_it": "Ran the full npm run check; the visual-verify gap is stated in the closure." }
]
```
