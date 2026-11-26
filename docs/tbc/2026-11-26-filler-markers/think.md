---
started_at: 2026-11-26T06:10:00Z
trigger: Gong ledger F9.6 (P2, PARTIAL) — "Still missing: … filler-word markers".
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Filler-word markers on the call page

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T09:27:33Z",
    "why_it_governs": "Ledger F9.6: Gong's points of interest include filler words; our call page had questions and tracker hits but no fillers. Before building, the record had to show our transcripts keep fillers at all — many speech-to-text engines strip them, and a count of zero would then be a confident lie.",
    "how_this_build_will_embody_it": "Production counted first (168 of 186 calls have um/uh lines); then markers from the rep's lines."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T09:27:33Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
    "how_this_build_will_embody_it": "Sections read at 2026-11-26T09:27:33Z, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T09:27:33Z",
    "why_it_governs": "Holistic: the questions list already reads the same timed segments; fillers must use the same timing, or two lists on one page disagree about when things were said.",
    "how_this_build_will_embody_it": "fillerMarkers runs on timing.segments beside questionMarkers."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-100",
    "read_at": "2026-11-26T09:27:33Z",
    "why_it_governs": "Layer 3: a manager reviewing a call wants to hear the moment, not just a count.",
    "how_this_build_will_embody_it": "Each moment plays the call from its time."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-158",
    "read_at": "2026-11-26T09:27:33Z",
    "why_it_governs": "Adjacent: 'like', 'so', 'you know' are often not filler; counting them would inflate the number.",
    "how_this_build_will_embody_it": "Only um / uh / uhm / erm; words like 'umbrella' and 'drum' are not matched (tested)."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-180",
    "read_at": "2026-11-26T09:27:33Z",
    "why_it_governs": "Depends on the speech-to-text keeping fillers — outside the repo. Verified on production data, and the page says the transcript may miss some.",
    "how_this_build_will_embody_it": "Production probe (counts only); the caveat line."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-316",
    "read_at": "2026-11-26T09:27:33Z",
    "why_it_governs": "The rep's talk time is the same segments' rep time; the rate is per minute of the rep's talk, computed once in the route.",
    "how_this_build_will_embody_it": "One function; the panel shows what the route sends."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-11-26T09:27:33Z",
    "why_it_governs": "Derived on read from the current transcript; nothing is stored.",
    "how_this_build_will_embody_it": "No writes."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-361",
    "read_at": "2026-11-26T09:27:33Z",
    "why_it_governs": "Erasure must reach every stored copy of a customer's words; fillers are computed from the rep's lines on read and never stored.",
    "how_this_build_will_embody_it": "Nothing new for erasure to reach."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-26T09:27:33Z",
    "why_it_governs": "Guide, don't overtake: the page shows the count and moments, never a judgement.",
    "how_this_build_will_embody_it": "No 'too many' label."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-391",
    "read_at": "2026-11-26T09:27:33Z",
    "why_it_governs": "No fixed day-one target: there is no 'good' filler rate; the number is this call's only.",
    "how_this_build_will_embody_it": "No threshold."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-456",
    "read_at": "2026-11-26T09:27:33Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No new decision."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-11-26T09:27:33Z",
    "why_it_governs": "Methodology in the working tree, consulted not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T09:27:33Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T09:27:33Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Tests for the word set, the rate floor and the screen."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T09:27:33Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
