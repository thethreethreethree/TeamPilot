---
started_at: 2026-11-24T21:25:49Z
trigger: Gong ledger F10.9 "Team page controls" (P1, PARTIAL): no team-level stats page or period.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Team call stats

## The record

session_interaction_stats (0277): per call, per transcript version; RLS: own or manager + tree. /[id]/stats shows a call's
stats and the rep's 30-day averages (latest version per call, nulls excluded).

## Outside view

Per-call numbers can't tell a manager whether the team talks too much; averages over a period can.

## Design

teamStats.ts (pure) → GET /api/coach/remote/team-stats?days= (manager, own client, paged) → TeamCallStats on Coaching.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-24T21:25:50Z",
    "why_it_governs": "Ledger F10.9: interaction stats exist per call with the rep's own average, but there is no team-level stats page or period picker.",
    "how_this_build_will_embody_it": "Team stats are averaged from the stored per-call rows (0277), the same source as the call page's strip."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-24T21:25:50Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-24T21:25:50Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-24T21:25:50Z",
    "why_it_governs": "Holistic: session_interaction_stats has one row per transcript version and nulls meaning 'not measurable'; the call page's averages already follow both rules.",
    "how_this_build_will_embody_it": "teamCallStats takes the latest version per call and averages only measurable values."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-24T21:25:50Z",
    "why_it_governs": "Layer 2-3: a manager opening Coaching wants the team's numbers over a period they pick.",
    "how_this_build_will_embody_it": "7 / 30 / 90-day switch; team row first; reps alphabetical."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-24T21:25:50Z",
    "why_it_governs": "Look past the task: averaging reps (not calls) would let a one-call rep weigh like a forty-call rep; a capped read would undercount.",
    "how_this_build_will_embody_it": "The team row averages calls; the read pages through fetchAllPagedResult."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-24T21:25:50Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "None: no migration or external config."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-24T21:25:50Z",
    "why_it_governs": "Which reps a manager may see is decided by the stats table's RLS (rss_tree_allows).",
    "how_this_build_will_embody_it": "Read through the manager's own client; nothing re-derives the tree."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-24T21:25:50Z",
    "why_it_governs": "Honesty: no benchmark that isn't ours; no zeros for unmeasured.",
    "how_this_build_will_embody_it": "Dashes for unmeasurable; 'your team's own numbers, not a target or a ranking'."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-24T21:25:50Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "None needed."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-24T21:25:50Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-24T21:25:50Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-24T21:25:50Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "teamStats tests pin latest-version, measurable-only and calls-weighted team; route test pins the company and channel filters."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-24T21:25:50Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
