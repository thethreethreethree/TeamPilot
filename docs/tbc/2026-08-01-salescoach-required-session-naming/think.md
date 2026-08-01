---
tbc_version: 1
trigger: feature
started_at: 2026-08-01T10:00:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 10
hypotheses: 1
---

# THINK — required session naming before After-Pitch (Phase 4)

## 1. Document integrity (§0.1) — MATCH

CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) MATCH DOC_MANIFEST (sha256sum in build.md).

## 2. Why (founder directive, decision gathered first — surface before asserting)

Founder: "every session will automatically ask the user to name session after finishing… then directed to
After-Pitch and Your Read", and chose "Require a name before continuing". A named session is findable in
Sessions and its duration/KPI attach to a real call, not an anonymous row. Naming at finish (not later) is the
only moment the rep still has the call in mind.

## 3. Design + interconnection (holistic ripple trace, §1.5.1 layer-3)

Unified ALL finish paths through one required gate: the manual "End session" button AND both recording-complete
callbacks (onRecordingSaved, onLabeled) now call `openNaming` instead of ending directly. `submitNameAndFinish`
sends ONE PATCH `{ status:"ended", clientLabel:name }` — ending + naming atomically — then routes to After-Pitch.
Safe/idempotent: the 0070 trigger stamps ended_at once on active→ended and never re-stamps (a re-finish keeps
the real end time). The modal has no X / no backdrop-close and Save is disabled until non-empty, so it's a true
required gate (§1.5.1 layer-3: the rep can't reach After-Pitch unnamed). Replaced the old `endSession` /
`endThenAfterPitch` (and the now-dead `ending` state) so there's ONE finish path, not three.

## 4. Hypothesis

- **H1:** every finish path opens the required naming modal; submitting names + ends the session and lands on
  After-Pitch (Your Read + scoreboard auto-generate there); typecheck clean; no dead `ending`/`endSession` refs.

## 5. Session-read manifest (A22, A35)

```json
[
  { "id": "§0",     "read_at": "2026-08-01T10:00:00Z", "source_file": "CLAUDE.md", "line_range": "10-20",   "why_it_governs": "Understanding earned — traced the PATCH schema (accepts status+clientLabel), the 0070 end-trigger idempotency, and every finish caller before unifying them.", "how_this_build_will_embody_it": "Section 3 traces the unified path." },
  { "id": "§0.1",   "read_at": "2026-08-01T10:00:00Z", "source_file": "CLAUDE.md", "line_range": "22-40",   "why_it_governs": "Methodology in the tree, read this session.", "how_this_build_will_embody_it": "Doc integrity MATCH via sha256sum." },
  { "id": "§1.5.1", "read_at": "2026-08-01T10:00:00Z", "source_file": "CLAUDE.md", "line_range": "78-96",   "why_it_governs": "Layer-3 workflow continuity — a required gate that leaves the rep flowing to After-Pitch, not stalled; the modal can't trap them (error keeps it open with a message).", "how_this_build_will_embody_it": "Modal → ended+named → After-Pitch in one step." },
  { "id": "§1.5.2", "read_at": "2026-08-01T10:00:00Z", "source_file": "CLAUDE.md", "line_range": "120-140", "why_it_governs": "THINK-then-search — searched every endSession/endThenAfterPitch caller so no finish path is left un-gated.", "how_this_build_will_embody_it": "check.md lists the callers unified." },
  { "id": "§3.5",   "read_at": "2026-08-01T10:00:00Z", "source_file": "CLAUDE.md", "line_range": "300-315", "why_it_governs": "Measurement — ending stamps ended_at, so the session duration KPI populates; naming attaches it to a real call.", "how_this_build_will_embody_it": "The finish PATCH sets status ended + clientLabel together." },
  { "id": "§6",     "read_at": "2026-08-01T10:00:00Z", "source_file": "CLAUDE.md", "line_range": "352-372", "why_it_governs": "Checklist — traced what the change affects (all finish callers, the removed state).", "how_this_build_will_embody_it": "closure notes the bounded blast radius + residual." },
  { "id": "A19",    "read_at": "2026-08-01T10:00:00Z", "source_file": "ThinkerThinker.md", "line_range": "57-58", "why_it_governs": "Methodology read from the tree this session.", "how_this_build_will_embody_it": "This-session read_at across entries." },
  { "id": "A22",    "read_at": "2026-08-01T10:00:00Z", "source_file": "ThinkerThinker.md", "line_range": "58-74", "why_it_governs": "Citations require session-reading.", "how_this_build_will_embody_it": "This manifest + the Session-Reads trailer." },
  { "id": "A30",    "read_at": "2026-08-01T10:00:00Z", "source_file": "ThinkerThinker.md", "line_range": "31-32", "why_it_governs": "Don't ship a half-thing — a required gate must not trap the rep; on error the modal stays open with a message rather than a dead half-ended state.", "how_this_build_will_embody_it": "submitNameAndFinish keeps the modal open on failure; only navigates on success." },
  { "id": "A38",    "read_at": "2026-08-01T10:00:00Z", "source_file": "ThinkerThinker.md", "line_range": "95-96", "why_it_governs": "'Verified' is a claim about a command run.", "how_this_build_will_embody_it": "check.md pastes typecheck output." }
]
```
