---
started_at: 2026-08-22T16:42:00+08:00
---

# THINK — Honest post-meeting recording state + KPI read error (audit M4 + L1)

The closing reliability-audit bundle. M4 (MED, meeting) + L1 (LOW, DoorLog KPI). L2 is deferred (rationale below).

## M4 — the meeting-ended screen promises a review over a possibly-lost recording (§3.4)

`useMeetingCoaching`'s clean-Stop persist was `void persistRecording(...).catch(() => {})` and the panel said "The
recording is saving now. Its review WILL be ready" **unconditionally**. If the clean-Stop persist fails AND no
live chunk landed, the facilitator is promised a review that can't exist — a §3.4 falsehood.

**Fix (make durability observable):** `postMeetingAudioChunk` now resolves `true` iff a chunk actually landed; the
hook counts landed chunks (`chunkOkRef`) and, on Stop, sets `recordingSaved`: `true` if the full-blob persist
succeeds OR any chunk landed, `false` only when a Stopped call saved nothing, `null` while in flight. The panel
renders honest copy from a PURE helper `meetingEndedRecordingCopy` (gate-tested): warn when false, "ready" when
true, "saving now" only while null. The hook stays mounted across the `sessionId→null` end transition, so the
value survives onto the ENDED screen and updates reactively as the persist resolves.

## L1 — a KPI read error renders a fabricated 0/0/0/0 strip (§3.4 / INV22)

`getKpiForDay` did `return data ?? []` and never inspected `error`, so a transient read error rendered the strip
as zeros — a falsehood dressed as no-data. **Fix:** classify the error (throw); the GET route catches → returns a
502 with a generic message (CWE-209-safe); the client's best-effort `loadKpi` keeps its last good strip instead of
blanking to zeros.

## L2 — DEFERRED
Pitch analysis feeds the client wall-clock `durationMs` into the prompt rather than the real audio length. LOW
blast-radius (it colors a prompt note, not a displayed metric), and the proper fix needs word-timestamp plumbing
that the pitch STT path (`transcribeSpeech`, text-only) doesn't expose — a larger change than the finding warrants
now. Tracked in the audit doc + closure residual.

## Class sweep (A26)
M4/L1 are both the honesty class (a failure shown as success/empty) the whole audit chased. With them, every
instance the three auditors surfaced is fixed or deferred-with-rationale; the swept boundary is recorded in
`docs/RELIABILITY-AUDIT-2026-08-22.md`.

## Session-read manifest (A22)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-23T03:31:58+08:00",
    "why_it_governs": "Understand before solving — diagnosed the swallow paths (persist catch; KPI error) from the code.",
    "how_this_build_will_embody_it": "Both fixes target the named swallow, plus an honest surface." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-08-23T03:31:58+08:00",
    "why_it_governs": "Methodology in the working tree, read this session.",
    "how_this_build_will_embody_it": "Re-opened §0/§0.1/§1.5.2/A19/A22 via Read at 03:31; the rest at 16:42 (same session)." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-138", "read_at": "2026-08-22T16:42:42+08:00",
    "why_it_governs": "Layer-2/4 — the surface must not state a falsehood (review promised / zero stats).",
    "how_this_build_will_embody_it": "Honest recording copy + a 502 (not a fake 0) keep the surface truthful." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-170", "read_at": "2026-08-23T03:31:58+08:00",
    "why_it_governs": "Proactive audit — swept the honesty class to its boundary; L2 deferred with rationale.",
    "how_this_build_will_embody_it": "Recorded the swept boundary + the deferral in the audit doc." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-388", "read_at": "2026-08-22T16:42:42+08:00",
    "why_it_governs": "Honesty is the moat — never promise a review over a lost recording, never fabricate a 0 strip.",
    "how_this_build_will_embody_it": "recordingSaved gates the copy; a KPI read error is a 502, not zeros." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-455", "read_at": "2026-08-22T16:42:42+08:00",
    "why_it_governs": "The quick-decision checklist gates any substantive action.",
    "how_this_build_will_embody_it": "Ran it: diagnosed from code, traced ripple, encoded a pure-helper gate for M4 + route tests for L1." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-477", "read_at": "2026-08-23T03:31:58+08:00",
    "why_it_governs": "Methodology in the working tree, read this session.",
    "how_this_build_will_embody_it": "Re-opened the cited axioms via Read this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-633", "read_at": "2026-08-23T03:31:58+08:00",
    "why_it_governs": "Citations need an in-session read.",
    "how_this_build_will_embody_it": "Each cited asset carries an in-session read_at (03:31 re-reads + 16:42 same-session)." },
  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-710", "read_at": "2026-08-22T16:42:42+08:00",
    "why_it_governs": "A reported bug is one instance of a class; sweep the boundary.",
    "how_this_build_will_embody_it": "M4/L1 close the honesty class; boundary recorded, L2 deferred with reason." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-790", "read_at": "2026-08-22T16:42:42+08:00",
    "why_it_governs": "Encode the lesson in a gate.",
    "how_this_build_will_embody_it": "Pure meetingEndedRecordingCopy test (3 states) + GET route tests (KPI error → 502)." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1023", "read_at": "2026-08-22T16:42:42+08:00",
    "why_it_governs": "'Verified' names the command you ran.",
    "how_this_build_will_embody_it": "check.md carries the full `npm run check` exit-0 output + the exact test count." }
]
```
