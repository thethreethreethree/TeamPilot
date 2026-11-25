---
started_at: 2026-11-25T22:31:38Z
trigger: Gong ledger F16.8 "Coaching metrics per manager" (P2, PARTIAL): no arrows vs the previous period.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Coaching metrics against the 30 days before

## Design

feedbackTotals(events, from, to) in feedback.ts (pure; D8's rule). The coaching-metrics route computes current and
previous (60→30 days ago) with it and returns `previous`. CoachingInbox shows ▲/▼ per count, earlier number in the title.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-25T22:31:39Z",
    "why_it_governs": "Ledger F16.8: coaching metrics per manager have no comparison with the previous period (Gong shows arrows), so a manager can't tell whether coaching is rising or falling.",
    "how_this_build_will_embody_it": "The three feedback counts also for the 30 days before, shown as ▲/▼."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-25T22:31:39Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "Sections printed by line at 2026-11-25T22:31:39Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T22:31:39Z",
    "why_it_governs": "Holistic: the metrics route, its CSV export and the by-rep rows read the same events; a second counting copy would drift.",
    "how_this_build_will_embody_it": "One pure feedbackTotals for both windows; the route's current numbers now come from it too."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T22:31:39Z",
    "why_it_governs": "Layer 3: a manager who stopped coaching would vanish from the table — the drop is what matters.",
    "how_this_build_will_embody_it": "Managers with feedback in the earlier window keep a row (tested)."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-25T22:31:39Z",
    "why_it_governs": "Look past the task: the earlier window must use the same calls as the current, or the arrow compares two populations.",
    "how_this_build_will_embody_it": "Both windows read events of the same calls (started in the last 180 days)."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-25T22:31:39Z",
    "why_it_governs": "No external configuration.",
    "how_this_build_will_embody_it": "None needed."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-25T22:31:39Z",
    "why_it_governs": "'What counts as feedback' is D8's countsAsFeedback.",
    "how_this_build_will_embody_it": "feedbackTotals calls it; nothing re-derived."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-25T22:31:39Z",
    "why_it_governs": "A trend must be derived from the record, not stored snapshots.",
    "how_this_build_will_embody_it": "Computed on read from the same append-only events."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-25T22:31:39Z",
    "why_it_governs": "No personal data is added.",
    "how_this_build_will_embody_it": "Counts only."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-25T22:31:39Z",
    "why_it_governs": "Guide, don't overtake: a trend is the team's own, not a grade.",
    "how_this_build_will_embody_it": "Neutral colour arrows with the earlier number in the title; no ranking change."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-25T22:31:39Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No new decision; listened-to comparison recorded as not built."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-25T22:31:39Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-25T22:31:39Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id was printed at the given line range this session."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-25T22:31:39Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "feedbackTotals test; route test for the earlier window; render test for arrows and the dropped manager."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-25T22:31:39Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
