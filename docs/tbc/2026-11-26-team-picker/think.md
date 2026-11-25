---
started_at: 2026-11-25T21:53:03Z
trigger: Gong ledger F10.9 "Team page controls" and F16.6 "Inbox actions and filters" (P1, PARTIAL): no switching to another manager's team.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Show one manager's team on Coaching

## Design

teamScope.ts: companyPeople, teamMembers (manager + reportsOf), teamsIn, teamFromRequest (?team= → members, refused
unless the caller may see that manager). GET /api/coach/remote/teams. The five coaching routes narrow with it.
TeamPicker on Remote Sales → Coaching; the choice in ?team=; panels take a team prop (withTeam).

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-25T21:53:04Z",
    "why_it_governs": "Ledger F10.9 and F16.6 (P1): a manager or admin can't look at one manager's team on the coaching screens — everything is the whole of what they can see.",
    "how_this_build_will_embody_it": "A team picker narrows the Coaching screens to one manager and everyone below them."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-25T21:53:04Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "Sections printed by line at 2026-11-25T21:53:04Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T21:53:04Z",
    "why_it_governs": "Holistic: five routes (inbox, metrics, usage, stats, coverage) take the new parameter; each already applies the tree and hides.",
    "how_this_build_will_embody_it": "The team only intersects with what each route already allows; without it the routes are unchanged (existing tests pass)."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T21:53:04Z",
    "why_it_governs": "Layer 3: the chosen team must survive a refresh and apply to every panel at once, or the page contradicts itself.",
    "how_this_build_will_embody_it": "One picker at the top; the choice is kept in ?team= and passed to all five panels."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-25T21:53:04Z",
    "why_it_governs": "Look past the task: a team parameter must not become a way to see a manager outside your tree, or to probe who exists.",
    "how_this_build_will_embody_it": "The caller must be allowed to see the chosen manager (treeAllowsRep) before anything is read; otherwise 404 (tested)."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-25T21:53:04Z",
    "why_it_governs": "No external configuration; the tree depends on manager_id being set on the Team page.",
    "how_this_build_will_embody_it": "The picker renders nothing when there is no team (no reporting tree yet)."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-25T21:53:04Z",
    "why_it_governs": "Who may be seen is decided by the database (rss_tree_allows / rss_tree_filter).",
    "how_this_build_will_embody_it": "The team list and the parameter use those functions through the caller's client; reportsOf only enumerates the team."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-25T21:53:04Z",
    "why_it_governs": "A saved team choice would be state that edits itself; the append-only rule means a view preference either becomes an event log or stays out of the database.",
    "how_this_build_will_embody_it": "Nothing is stored: the choice lives in the page URL, so no row is ever edited."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-25T21:53:04Z",
    "why_it_governs": "Erasure is unaffected by a read-only narrowing.",
    "how_this_build_will_embody_it": "No call content is read beyond what the routes already read."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-25T21:53:04Z",
    "why_it_governs": "Guide, don't overtake: the manager chooses the view.",
    "how_this_build_will_embody_it": "Default is everyone the manager can see; narrowing is opt-in."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-25T21:53:04Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No new decision; the panels not yet scoped are recorded."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-25T21:53:04Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-25T21:53:04Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id was printed at the given line range this session."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-25T21:53:04Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Tests: team members/teams, the parameter's refusals, the teams list, a route's narrowing, the picker and a panel's refetch."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-25T21:53:04Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
