---
started_at: 2026-08-23T13:00:00+08:00
---

# THINK — pending-audio review: a hard auto-terminal after N retries (audit D5, A20 default)

## The correction that triggered this
I had repeatedly flagged this item as "a founder UX-design call" and declined to build it. That is exactly the
**A20** failure — "'Founder decision needed' is the agent substituting its own quality bar for the founder's."
A20 (and the founder's persistent HARD-MODE guard) says: build a DEFENSIBLE DEFAULT and propose it, don't offload
a decidable UX point. The pending-audio terminal is decidable; I was wrongly holding it. This builds the default.
(Contrast D4, which the founder EXPLICITLY deferred — that's the founder's stated decision, not my offload, so it
stays deferred; A20 targets MY offloading, not the founder's own deferrals.)

## Root + why the default is safe
The review's dissect route stitches audio ON-DEMAND (INT-1); a 409 means the synchronous stitch found no chunks.
Because chunks upload DURING the call, by review-time a 409 is almost always TERMINAL (the meeting wasn't
recorded); the only transient case is the narrow window where the last chunk is still landing right as the rep
opens the review. The old UI offered "Try again" endlessly, so a rep whose meeting genuinely wasn't recorded was
stuck. **Default:** after `MAX_PENDING_RETRIES` (3) consecutive 409s, transition to a hard "no-recording" terminal
(states the truth, drops Try-again, keeps Back). 3 tries comfortably covers the mid-upload window, so the
false-terminal risk is low; and a fresh navigation to the review remounts + resets the counter, so a determined
rep can still re-check if audio lands late. The honest interim copy (`3f23af7d`) already covered the soft case;
this adds the hard terminal on top.

## Ripple (holistic — §6 checklist item 5)
Client-only, additive: a `pendingRetriesRef` counter + one state ("no-recording") + one render branch. The count
increments only on a 409 and resets on ANY non-409 result (a recovered/ready review or a different error), so it
can never prematurely terminate a review that actually loaded. No route/server/schema change. The existing
pending-audio + error + ready states are untouched below the threshold.

## Session-read manifest (A22)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-23T13:09:20+08:00",
    "why_it_governs": "Understand the 409 semantics before building — verified (INT-1) that a review-time 409 is ~terminal because chunks upload during the call.",
    "how_this_build_will_embody_it": "The default is grounded in the real 409 semantics (terminal-dominant), so the auto-terminal is honest, not a guess." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-08-23T13:09:30+08:00",
    "why_it_governs": "Methodology in the tree, read THIS build.",
    "how_this_build_will_embody_it": "Re-opened every cited section fresh (read_at ≥ started_at 13:00)." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-138", "read_at": "2026-08-23T13:09:45+08:00",
    "why_it_governs": "Layer-3/4 — a review that offers Try-again forever strands the rep; a clear terminal state restores continuity.",
    "how_this_build_will_embody_it": "The hard terminal gives a flowing end (clear truth + Back), not an endless-retry dead-end." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-172", "read_at": "2026-08-23T13:10:00+08:00",
    "why_it_governs": "Proactive — this closes the audit's flagged gap with a real default, not a deferral.",
    "how_this_build_will_embody_it": "Built the default + a detection test; didn't offload the decidable UX point." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-455", "read_at": "2026-08-23T13:10:10+08:00",
    "why_it_governs": "The quick-decision checklist (holistic ripple, item 5).",
    "how_this_build_will_embody_it": "Traced ripple (count resets on non-409; remount re-checks); explained WHY; added a test." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-477", "read_at": "2026-08-23T13:10:20+08:00",
    "why_it_governs": "Methodology in the working tree — no cited-from-cache labels.",
    "how_this_build_will_embody_it": "Re-opened the cited axioms via Read this build." },
  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-362", "read_at": "2026-08-23T13:11:20+08:00",
    "why_it_governs": "Guide, don't overtake — distinguishes the founder's EXPLICIT deferral (D4, respect it) from a decidable point I was wrongly offloading (the auto-terminal, build it per A20).",
    "how_this_build_will_embody_it": "Built the auto-terminal (my offload → A20 default) while leaving D4 deferred (the founder's own stated decision)." },
  { "id": "A20", "source_file": "ThinkerThinker.md", "line_range": "480-520", "read_at": "2026-08-23T13:08:40+08:00",
    "why_it_governs": "'Founder decision needed' is substituting the agent's quality bar for the founder's — build a defensible default, don't offload.",
    "how_this_build_will_embody_it": "This build IS the correction: I stop offloading the auto-terminal and ship a defensible default (the founder can adjust the threshold/copy)." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-633", "read_at": "2026-08-23T13:10:30+08:00",
    "why_it_governs": "Citations without a session-read are undetected A19 violations.",
    "how_this_build_will_embody_it": "Each cited asset carries a current in-session read_at (≥ started_at 13:00); the Session-Reads trailer lists them." },
  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-720", "read_at": "2026-08-23T13:10:40+08:00",
    "why_it_governs": "Verify the finding against the code before building.",
    "how_this_build_will_embody_it": "Confirmed the 409-is-terminal-dominant semantics (INT-1) + the endless-Try-again before building the terminal." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-790", "read_at": "2026-08-23T13:10:50+08:00",
    "why_it_governs": "Encode the lesson in a gate.",
    "how_this_build_will_embody_it": "+2 detection tests: hard terminal after MAX 409s (no Try-again, Back present); a non-409 resets (no premature terminal)." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1023", "read_at": "2026-08-23T13:11:00+08:00",
    "why_it_governs": "'Verified' names the exact command you ran.",
    "how_this_build_will_embody_it": "check.md pastes the full `npm run check` output + EXIT code." }
]
```
