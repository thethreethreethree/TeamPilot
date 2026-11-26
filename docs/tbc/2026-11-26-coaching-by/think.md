---
started_at: 2026-11-26T01:21:13Z
trigger: Gong ledger F16.6 "Inbox actions and filters" (P1, PARTIAL) — "Not built: Gong's 'only theirs / only yours / both' coaching selector."
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Coaching by: everyone, theirs, or yours

## What the record shows

CoachingInbox's metrics table lists one row per manager who coached the picked team (bef9f517 team picker). Gong lets a
manager looking at another manager's team choose whose coaching to see. Ours shows everyone, always.

## Design

A three-way filter (Everyone · that manager · You) over the table's rows, shown only when another manager's team is
picked, reset on every team change; an empty filter says whose coaching is missing.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T01:22:10Z",
    "why_it_governs": "F16.6's last gap is Gong's 'only theirs / only yours / both' choice when viewing another manager's team; our table already has one row per manager, so the gap is a way to see just the team's manager or just yourself.",
    "how_this_build_will_embody_it": "A row filter over the same numbers; nothing recomputed."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T01:22:10Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
    "how_this_build_will_embody_it": "Sections printed in full at 2026-11-26T01:22:10Z, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "64-76",
    "read_at": "2026-11-26T01:22:10Z",
    "why_it_governs": "Holistic: the table, its CSV and the by-rep rows all read the same metrics; a filter that changed the request would make the CSV disagree with the screen.",
    "how_this_build_will_embody_it": "The filter only hides rows on screen; the request, totals and CSV are unchanged."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-100",
    "read_at": "2026-11-26T01:22:10Z",
    "why_it_governs": "Layer 3: a filter that survives a team change would show 'only theirs' for a different manager.",
    "how_this_build_will_embody_it": "It resets to Everyone whenever the team changes, and is offered only for another manager's team."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-158",
    "read_at": "2026-11-26T01:22:10Z",
    "why_it_governs": "Adjacent: an empty filtered table must say why, not look like no one coached.",
    "how_this_build_will_embody_it": "A sentence names whose coaching is missing in the period."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-180",
    "read_at": "2026-11-26T01:22:10Z",
    "why_it_governs": "No configuration outside the repository is involved.",
    "how_this_build_will_embody_it": "None needed."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-316",
    "read_at": "2026-11-26T01:22:10Z",
    "why_it_governs": "Whose coaching counts is the route's D8 verdict per manager; the filter must not re-decide it.",
    "how_this_build_will_embody_it": "It filters ids of rows the route already returned."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-11-26T01:22:10Z",
    "why_it_governs": "Coaching metrics are derived on read from append-only events; a screen filter writes nothing.",
    "how_this_build_will_embody_it": "No table or write."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-361",
    "read_at": "2026-11-26T01:22:10Z",
    "why_it_governs": "Counts only; erasure is unaffected by how rows are filtered on screen.",
    "how_this_build_will_embody_it": "Nothing new for erasure to reach."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-26T01:22:10Z",
    "why_it_governs": "Comparing your own coaching with the team's manager is self-assessment, not a ranking.",
    "how_this_build_will_embody_it": "Neutral buttons; the default is everyone."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-456",
    "read_at": "2026-11-26T01:22:10Z",
    "why_it_governs": "Checklist item 0: any decision goes to the founder as a picker.",
    "how_this_build_will_embody_it": "No new decision."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-11-26T01:22:10Z",
    "why_it_governs": "Methodology in the working tree, consulted not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T01:22:10Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id here was printed at its line range after started_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T01:22:10Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Render tests: Everyone / theirs / you, and not offered on your own team."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T01:22:10Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
