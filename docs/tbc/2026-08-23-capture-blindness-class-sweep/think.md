---
started_at: 2026-08-23T03:31:30+08:00
---

# THINK — Sweep the capture-blindness class to the live, meeting, and C.A.R.E recorders (A26)

The DoorLog P0 fix (`a9402dcb`) named a CLASS: *"a media-capture path that discards its own failure signal, so a
zero-output is unexplainable."* A26 says a reported bug is one instance of a class — sweep the boundary. Founder
chose this sweep (2026-08-23 picker). The boundary is the four MediaRecorder-based recorders; DoorLog is fixed,
these three shared the shape:

- **live sales** (`useLiveCoaching.ts`): had the honest `audioCapturing` banner but NO `onerror` and NO mic-track
  death detection — a dying track only flipped the banner at the NEXT Stop, and a recorder error was invisible.
- **meeting** (`useMeetingCoaching.ts`): had `recordingSaved` (post-stop honesty, M4) but no `onerror` / track death.
- **C.A.R.E voice** (`useVoiceMode.ts`): turn-based; the code even NOTES a "permanently-deaf call" risk (line ~453)
  but never detected the mic track dying mid-call — a deaf call just re-armed forever, silently.

## The fix (one shared primitive, applied to each — fixed at the foundation, not per-recorder bandaids)

- `src/lib/coach/captureDiag.ts` (NEW): the canonical `CaptureDiag` shape + `buildCaptureDiag` (pure) +
  `reportCaptureDiag(surface, diag, sessionId?)` (best-effort keepalive POST). ONE shape all recorders report.
- `POST /api/coach/capture-diag` (NEW): authenticated + company-PINNED (INV15), bounded body, appends a
  `coach.capture_failed` event scoped to the session (or the rep for C.A.R.E). DoorLog keeps its own pre-session
  `/door-log/capture-diag` (already shipped); this is the session-scoped sibling for the other three.
- **live**: add `rec.onerror` + mic-track `ended`/`mute` listeners → flip the EXISTING `audioCapturing` banner OFF
  the moment capture dies (no new UI — the hardened reference already has the honest banner), and report a
  `coach.capture_failed` diag on a meaningful-duration (>3s) session that captured zero chunks.
- **meeting**: add `rec.onerror` + track listeners (record the cause) → report a diag on a >3s zero-capture stop;
  its `recordingSaved` (M4) already carries post-stop honesty. (Unwired MVP — no new live UI.)
- **C.A.R.E**: add `rec.onerror` + a one-time deaf-call detector on the call stream (track `ended`/`mute`) → report
  a `care` diag. Robust + minimal: it omits the sessionId (the conversation id isn't reliably in scope, and I will
  NOT risk a wrong variable in a live subsystem) — subject `rep:userId`, filterable by `surface:"care"`.

## Honesty + discipline (§3.4, §0, §1.2)
No cause is *asserted* — this makes each recorder's failure OBSERVABLE (the DoorLog correction lesson: instrument,
don't assume). Additive everywhere: the existing chunk/blob/save/turn paths are byte-unchanged; the >3s guard keeps
a quick start/stop from being reported as a failure; all reporting is best-effort (never touches the flow).

## Ripple (§1.5, holistic)
Three load-bearing files (live has reconnect seams; C.A.R.E has a turn-lock/VAD loop) — instrumentation is purely
additive (new listeners + a guarded report), and each recorder's existing test suite passes unchanged (80 files /
584 tests green). No schema change (reuses `events`).

## Session-read manifest (A22)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-23T03:31:58+08:00",
    "why_it_governs": "Understand before solving — the class was named from the code, and this sweeps its boundary.",
    "how_this_build_will_embody_it": "Each recorder is instrumented to OBSERVE its failure; no cause is assumed." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-08-23T03:31:58+08:00",
    "why_it_governs": "Methodology in the working tree, read this session.",
    "how_this_build_will_embody_it": "Re-opened the cited CLAUDE §§ + axioms via Read this session." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-59", "read_at": "2026-08-23T04:05:28+08:00",
    "why_it_governs": "Retrospective / pattern-detection — a bug across recorders is a class, not four one-offs.",
    "how_this_build_will_embody_it": "Swept the same shape across all four recorders instead of patching one." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-73", "read_at": "2026-08-23T04:05:28+08:00",
    "why_it_governs": "Holistic — don't break the reconnect/turn-loop while instrumenting.",
    "how_this_build_will_embody_it": "Additive listeners only; every existing recorder suite passes (80 files/584 tests)." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-138", "read_at": "2026-08-23T04:05:28+08:00",
    "why_it_governs": "Layer-2 — capturing audio is each surface's job; a silent dead mic defeats it.",
    "how_this_build_will_embody_it": "live flips its honest banner on track death; all three report the cause." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-170", "read_at": "2026-08-23T03:31:58+08:00",
    "why_it_governs": "Proactive audit — sweep the class to its boundary, not just the reported instance.",
    "how_this_build_will_embody_it": "All four recorders now capture + report their failure; DoorLog + these three." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-388", "read_at": "2026-08-23T04:06:00+08:00",
    "why_it_governs": "Honesty is the moat — a failure the system can't explain is dressed as mystery.",
    "how_this_build_will_embody_it": "Every recorder's zero-audio is now legible via coach.capture_failed; no assertion of cause." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-455", "read_at": "2026-08-23T04:06:00+08:00",
    "why_it_governs": "The quick-decision checklist gates any substantive action.",
    "how_this_build_will_embody_it": "Ran it: named the class, traced ripple across 3 load-bearing files, encoded gates, no regressions." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-477", "read_at": "2026-08-23T03:31:58+08:00",
    "why_it_governs": "Methodology in the working tree, read this session.",
    "how_this_build_will_embody_it": "Re-opened the cited axioms via Read this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-633", "read_at": "2026-08-23T03:31:58+08:00",
    "why_it_governs": "Citations need an in-session read.",
    "how_this_build_will_embody_it": "Each cited asset carries a current in-session read_at." },
  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-710", "read_at": "2026-08-23T04:05:28+08:00",
    "why_it_governs": "A reported bug is one instance of a class; sweep the boundary — the whole point of this build.",
    "how_this_build_will_embody_it": "Swept the capture-blindness class to all four recorders; boundary now closed." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-790", "read_at": "2026-08-23T04:06:00+08:00",
    "why_it_governs": "Encode the lesson in a gate.",
    "how_this_build_will_embody_it": "Pure buildCaptureDiag test + the generic endpoint gate (auth/company-pin/scoping/validation)." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1023", "read_at": "2026-08-23T04:06:00+08:00",
    "why_it_governs": "'Verified' names the command you ran.",
    "how_this_build_will_embody_it": "check.md carries the full `npm run check` exit-0 output + the exact test count." }
]
```
