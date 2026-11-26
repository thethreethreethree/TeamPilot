---
started_at: 2026-11-26T01:41:08Z
trigger: docs/tbc/2026-11-26-session-list-tree R1 — no audit caught a service-role read of reps' calls without the reporting tree.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - The reporting-tree audit sees every manager check

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T01:45:05Z",
    "why_it_governs": "Invariant 36 (2026-11-15) requires the tree on service-role manager routes, but it keyed on requireSalesCoachManager; six routes that decide 'manager' with isSalesCoachManager / canManagerViewRepSkills were never checked, and none asked the tree. The cause is the audit's trigger, not each route.",
    "how_this_build_will_embody_it": "The trigger now matches every manager check; the six routes ask the tree; the audit has 0 violations."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T01:45:05Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
    "how_this_build_will_embody_it": "Sections printed in full at 2026-11-26T01:45:05Z, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "64-76",
    "read_at": "2026-11-26T01:45:05Z",
    "why_it_governs": "Holistic: the rep-view routes share canManagerViewRepSkills; the tree is added after it in each rather than inside it (it is pure and sync).",
    "how_this_build_will_embody_it": "One added check per route, the same 404 as another company's rep."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-100",
    "read_at": "2026-11-26T01:45:05Z",
    "why_it_governs": "Layer 2: a manager outside a rep's chain must not see that rep's recordings, activity, skills, ELO or coaching.",
    "how_this_build_will_embody_it": "Route tests for the 404s on recordings, skills and ELO."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-158",
    "read_at": "2026-11-26T01:45:05Z",
    "why_it_governs": "Adjacent: the widened trigger surfaced Coach Assessment, which read every rep's coaching with the service role.",
    "how_this_build_will_embody_it": "Its roster now goes through treeFilterReps."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-180",
    "read_at": "2026-11-26T01:45:05Z",
    "why_it_governs": "The tree is the database's rule; production has 0 manager links, so nothing was exposed yet.",
    "how_this_build_will_embody_it": "Checked by count."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-316",
    "read_at": "2026-11-26T01:45:05Z",
    "why_it_governs": "The tree verdict is rss_tree_allows / rss_tree_filter; these routes re-decided access as 'same company'.",
    "how_this_build_will_embody_it": "Each now consumes treeAllowsRep / treeFilterReps."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-11-26T01:45:05Z",
    "why_it_governs": "Read-access changes only; no event or table is written differently.",
    "how_this_build_will_embody_it": "No table or write."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-361",
    "read_at": "2026-11-26T01:45:05Z",
    "why_it_governs": "Fewer people can see a rep's data; erasure is unaffected.",
    "how_this_build_will_embody_it": "Nothing new for erasure to reach."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-26T01:45:05Z",
    "why_it_governs": "Coaching visibility follows the org chart the company set.",
    "how_this_build_will_embody_it": "The tree decides, as in RLS."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-456",
    "read_at": "2026-11-26T01:45:05Z",
    "why_it_governs": "Checklist item 0: any decision goes to the founder as a picker.",
    "how_this_build_will_embody_it": "No new decision: the tree is the existing rule (0273)."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-11-26T01:45:05Z",
    "why_it_governs": "Methodology in the working tree, consulted not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T01:45:05Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id here was printed at its line range after started_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T01:45:05Z",
    "why_it_governs": "A gate that can't see its own blind spot: invariant 36 passed while six routes broke its rule.",
    "how_this_build_will_embody_it": "The trigger is widened and the newly matched routes are listed with real reasons."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T01:45:05Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
