---
started_at: 2026-08-27T09:45:00+08:00
---

# THINK — usage roster hid whether "active" sessions actually captured audio

## Why (the record — from live diagnostic data, not theory)
The founder's stated need was "monitor their usage" (view-session fix). While closing the iOS-capture loop I ran
`diag-capture-live.mjs`: the three monitored reps' recent captures were 20/20 iOS webm STUBS (chunksUploaded=0,
sub-viable bytes) — i.e. they were ACTIVE but captured no usable audio for days. I then looked at the surface the
founder actually monitors — the manager usage roster (`StandardSessionsManagerView`) — and found the honesty gap:

- `team-activity/route.ts` COMPUTES `withAudio` per rep (line 57/63 — how many sessions had a stored recording),
- the roster `Activity` type CARRIES it (line 21),
- but the roster annotation RENDERED only `count · last active` (line 86) — `withAudio` was computed and **dropped**.

So a rep who ran 44 sessions that ALL failed to capture audio read as "44 sessions · last active 2d ago" — healthy.
The founder monitoring at-a-glance would see thriving usage while the actual output was zero. This is the "dead
surface hides a silent gap" lens landing on a §3.4 honesty failure in the EXACT surface built to catch it, and a
§1.5.1-layer-2 miss: the monitoring feature technically listed activity but did not deliver the intended result
(whether the usage produced anything usable).

## The fix (§1.5 organic/holistic; §1.5.1 layer 2 + §3.4)
Surface `withAudio` in the roster annotation — `"44 sessions · N with audio · last active …"` — and render the
all-failed case as `"⚠ none with audio"` (the ⚠ glyph is a colored warning regardless of CSS, so the capture-failure
pops even in a scanned roster). No route change (the signal was already computed); the fix consumes the dropped value.
the leader-visibility framing is preserved: this is activity/honesty, not a rank — the roster stays unsorted.

## Gate (A30 — the dropped-signal class had just occurred, so lock it)
A jsdom render test (`StandardSessionsManagerView.render.test.tsx`) mocks the two roster fetches and asserts: a rep
with count>0 and withAudio=0 shows "⚠ none with audio" (not a healthy count), and a healthy rep shows "N with audio".
A future refactor dropping `withAudio` from the render fails it.

## Session-read manifest (A22 — read_at ≥ started_at 09:45:00)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-12", "read_at": "2026-08-27T09:56:00+08:00",
    "why_it_governs": "Understand the gap from the record (the diagnostic data) before changing the surface.",
    "how_this_build_will_embody_it": "The gap was found from live diag data + reading the route/view, not assumed." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-24", "read_at": "2026-08-27T09:56:10+08:00",
    "why_it_governs": "Methodology in the tree, read this build.",
    "how_this_build_will_embody_it": "Cited axioms re-opened via Read this session (09:56)." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-73", "read_at": "2026-08-27T10:00:00+08:00",
    "why_it_governs": "Organic + Holistic — consume the already-computed signal minimally; break no neighbor.",
    "how_this_build_will_embody_it": "The fix reads a value the route already returns; no route/schema/other-surface change." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "89-92", "read_at": "2026-08-27T09:56:20+08:00",
    "why_it_governs": "Layer 2 — the monitoring feature must actually deliver the intended result, not just list rows.",
    "how_this_build_will_embody_it": "The roster now answers 'did the usage produce usable audio?', the monitoring point." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "150-152", "read_at": "2026-08-27T09:56:30+08:00",
    "why_it_governs": "Proactive audit — I looked at the surface adjacent to the iOS fix and found the honesty gap.",
    "how_this_build_will_embody_it": "Hypothesis (usage may hide capture failure) → confirmed from route + view + data." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-367", "read_at": "2026-08-27T09:56:40+08:00",
    "why_it_governs": "Honesty — 'active' must not read as healthy when every capture failed.",
    "how_this_build_will_embody_it": "The roster surfaces with-audio counts and flags the all-failed case in a warning." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-435", "read_at": "2026-08-27T09:56:50+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Ran it: understood from data, consumed an already-computed signal, gated the honesty." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-455", "read_at": "2026-08-27T09:57:00+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-594", "read_at": "2026-08-27T09:57:10+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every § with a fresh read_at; the trailer lists them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-770", "read_at": "2026-08-27T09:57:20+08:00",
    "why_it_governs": "Gate the lesson — the dropped-signal 'dead surface' bug had just occurred.",
    "how_this_build_will_embody_it": "A render test locks that withAudio is surfaced + the all-failed case flagged." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1001", "read_at": "2026-08-27T09:57:30+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the real `npm run check` output + EXIT code." }
]
```
