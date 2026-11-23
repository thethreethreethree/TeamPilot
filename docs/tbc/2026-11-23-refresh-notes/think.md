---
started_at: 2026-11-23T21:28:49Z
trigger: OPEN.md transcript-edits "transcript corrections do not redo the AI summary, review and follow-through".
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Refresh the AI notes after transcript corrections

## The record

- transcript-edit route: POST corrects one line (0311) and redoes trackers + talk stats after the response.
- trim route: after changing the transcript, generateSessionArtifacts re-runs after the response.
- Also measured here (no build): "keep transcripts only" is used by 0 companies; daily audio calls peak at 6 — that
  residual's batching trigger is far off (OPEN.md note).

## Outside view

Five paid calls per edit is wasteful; never refreshing leaves notes contradicting the corrected transcript. One
refresh on request after a batch of edits is the honest middle.

## Design

PUT on the transcript-edit route (same access rule): needs ≥1 correction, rate-limited, audited
("transcript.refresh_notes"), generateSessionArtifacts after the response. SessionTranscript shows "Refresh the AI notes
with these corrections" when the editor has corrections.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T21:31:18Z",
    "why_it_governs": "Understand before building: a correction (0311) makes a new transcript version and redoes the free reads (trackers, talk stats), but the AI summary, review and follow-through stay built on the old words; redoing them is several paid AI calls per edit.",
    "how_this_build_will_embody_it": "Redo them only on request, once after a batch of edits, with the same function a trim uses."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T21:31:18Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T21:31:18Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T21:31:18Z",
    "why_it_governs": "Layer 3: after correcting a misheard price, the rep expects the summary to say the right price too.",
    "how_this_build_will_embody_it": "A button in the transcript editor once corrections exist; the reply says when to reload."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T21:31:18Z",
    "why_it_governs": "Holistic: generateSessionArtifacts is the one routine every re-run uses (finalize, relabel, trim); it honours sales-only and the guidance gate itself.",
    "how_this_build_will_embody_it": "The refresh calls it unchanged, after the response, like the trim route."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T21:31:18Z",
    "why_it_governs": "Look past the task: an open refresh endpoint could be used to run paid AI calls repeatedly.",
    "how_this_build_will_embody_it": "Same people as editing, only with at least one correction, audit-logged, 3 per 10 minutes per person."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T21:31:18Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "None: no migration or external config; uses the existing AI provider path."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T21:31:18Z",
    "why_it_governs": "Who may change a call's transcript-derived notes is the same decision as who may correct the transcript.",
    "how_this_build_will_embody_it": "PUT uses the route's own access() helper — one rule for both."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T21:31:18Z",
    "why_it_governs": "Notes are regenerated as new records, never edited in place, and the request itself is recorded.",
    "how_this_build_will_embody_it": "generateSessionArtifacts appends; an audit row records who asked and how many corrections."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T21:31:18Z",
    "why_it_governs": "Legal erasure is the one deletion exception.",
    "how_this_build_will_embody_it": "Not touched."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T21:31:18Z",
    "why_it_governs": "Guide, don't overtake: the person decides when the notes are redone; nothing reruns on its own.",
    "how_this_build_will_embody_it": "Button only; no automatic re-run on edit."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T21:31:18Z",
    "why_it_governs": "Honesty: notes that quote words the transcript no longer says are a stale claim.",
    "how_this_build_will_embody_it": "The editor offers the refresh as soon as a correction exists."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T21:31:18Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No decision needed: the residual named the build (a button, run once after a batch)."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T21:31:18Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T21:31:18Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T21:31:18Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Route tests (allowed, refused without corrections or rights, audited) and render tests (button shown only with corrections, sent once)."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T21:31:18Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
