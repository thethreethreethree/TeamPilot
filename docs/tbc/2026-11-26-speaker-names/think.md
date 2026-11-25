---
started_at: 2026-11-25T22:02:59Z
trigger: Gong ledger F8.5 "Rename speakers on the call page" (P1, PARTIAL).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Name the speakers on a call

## Design

0343 call_speaker_names (append-only, erasure-aware, call readers + hide rule) and rss_erase_sessions = 0317's body +
one delete. speakerNames.ts (latest per speaker, clean). /api/coach/remote/[id]/speaker-names (GET via caller client;
POST rep or tree manager). SpeakerNamesForm in SessionTranscript (opt-in speakerNames, on for phone/video).

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-25T22:03:00Z",
    "why_it_governs": "Ledger F8.5 (P1): a transcript can only say 'Rep' or 'Customer'; Gong lets a participant or admin give speakers names.",
    "how_this_build_will_embody_it": "A phone/video call's two speakers can be named; the transcript shows the names."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-25T22:03:00Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "Sections printed by line at 2026-11-25T22:03:00Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T22:03:00Z",
    "why_it_governs": "Holistic: a new call-keyed table touches erasure, the hide, RLS and the transcript component shared with in-person calls.",
    "how_this_build_will_embody_it": "Erasure redefined from 0317 with one delete (diffed); hide rule; in-person transcripts unchanged unless opted in (tested)."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T22:03:00Z",
    "why_it_governs": "Layer 3: naming must happen where the transcript is read, and only for those who can correct it.",
    "how_this_build_will_embody_it": "A 'Name the speakers' control in the transcript, shown to editors; everyone who can open the call sees the names."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-25T22:03:00Z",
    "why_it_governs": "Look past the task: a manager outside the rep's tree must not write to the call through the service role.",
    "how_this_build_will_embody_it": "treeAllowsRep before a manager's write (the invariant audit caught it; tested)."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-25T22:03:00Z",
    "why_it_governs": "The feature depends on 0343 in production.",
    "how_this_build_will_embody_it": "db:apply applied 0343; verify:live 33 hold."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-25T22:03:00Z",
    "why_it_governs": "Who may open the call is RLS's verdict; who may write is rep-or-tree-manager.",
    "how_this_build_will_embody_it": "getSession through the caller's client; treeAllowsRep for managers; no re-derived rule."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-25T22:03:00Z",
    "why_it_governs": "Append-only: a renamed speaker must not erase the earlier name record.",
    "how_this_build_will_embody_it": "New rows; latest per speaker wins; update/delete refused outside erasure (replayed)."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-25T22:03:00Z",
    "why_it_governs": "A customer's name is personal data — erasure must remove it, and only erasure may delete these rows.",
    "how_this_build_will_embody_it": "rss_erase_sessions deletes call_speaker_names (replay: erased 1, 0 left); rules yield only to rss.erasure."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-25T22:03:00Z",
    "why_it_governs": "Guide, don't overtake: names are the person's choice.",
    "how_this_build_will_embody_it": "Optional; an empty name restores the plain label."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-25T22:03:00Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No new decision; talk-time lanes keep You/Customer (recorded)."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-25T22:03:00Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-25T22:03:00Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id was printed at the given line range this session."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-25T22:03:00Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "erasureCoverage and hideCoverage now judge call_speaker_names; route and render tests."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-25T22:03:00Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
