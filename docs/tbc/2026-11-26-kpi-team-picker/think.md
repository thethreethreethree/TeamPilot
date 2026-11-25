---
started_at: 2026-11-25T23:16:04Z
trigger: Gong ledger F23.8 "Dashboard team and period selectors" (P2, PARTIAL).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - KPI team table: pick one manager's team

## Design

/api/coach/kpi/team takes ?team= via teamFromRequest (tree-checked). The KPI page's Team section shows TeamPicker; a
choice reloads only the per-rep table.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-25T23:16:05Z",
    "why_it_governs": "Ledger F23.8: the KPI page's per-rep table can't be narrowed to one manager's team (Gong dashboards pick a team).",
    "how_this_build_will_embody_it": "The same team picker as Coaching on the KPI page's Team table."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-25T23:16:05Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "Sections printed by line at 2026-11-25T23:16:05Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T23:16:05Z",
    "why_it_governs": "Holistic: the KPI headline cards pool the company or show your own; narrowing them too would change what those numbers mean.",
    "how_this_build_will_embody_it": "The picker narrows only the per-rep table, and says so in place."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T23:16:05Z",
    "why_it_governs": "Layer 3: switching to an empty team must not leave the previous team's rows on screen.",
    "how_this_build_will_embody_it": "A chosen team always replaces the rows, even when empty."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-25T23:16:05Z",
    "why_it_governs": "Look past the task: a team parameter must not reach outside the caller's tree.",
    "how_this_build_will_embody_it": "teamFromRequest with treeAllowsRep; refused → 404 before anything is read (tested)."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-25T23:16:05Z",
    "why_it_governs": "No external configuration; the tree needs managers set on the Team page.",
    "how_this_build_will_embody_it": "The picker renders nothing when there are no teams."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-25T23:16:05Z",
    "why_it_governs": "Who may be seen stays the database's verdict.",
    "how_this_build_will_embody_it": "The route still reads through the caller's client; the team only narrows the member list."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-25T23:16:05Z",
    "why_it_governs": "A view choice must not become stored state that edits itself.",
    "how_this_build_will_embody_it": "Kept in component state; nothing written."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-25T23:16:05Z",
    "why_it_governs": "No personal data added; erasure keeps outcomes as facts the KPIs use.",
    "how_this_build_will_embody_it": "Counts only, as before."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-25T23:16:05Z",
    "why_it_governs": "Guide, don't overtake: the manager chooses the view.",
    "how_this_build_will_embody_it": "Default is everyone they can see."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-25T23:16:05Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No new decision."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-25T23:16:05Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-25T23:16:05Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id was printed at the given line range this session."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-25T23:16:05Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Route test: narrowed read and refused team."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-25T23:16:05Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
