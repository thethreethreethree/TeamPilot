---
started_at: 2026-11-23T20:52:39Z
trigger: Founder 2026-11-23 "keep building everything in the list" — OPEN.md client reads "other spellings of 'failed read → nothing' are not matched by the guard".
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Third sweep: failed reads shown as "none"

## The record

- Guard covers `r.ok ? r.json() : {…null/[]}` and `r.ok ? r.json() : null` (counted allowances).
- Uncovered: `if (!r.ok) return null` (1 site: WeeklyRoutine, deliberately "unknown"), `fetch().catch(() => null)`
  (158) and `.catch(() => [])` (1).

## Outside view

`.catch(() => null)` on a fetch only means "no response"; harm comes from what follows. Read each site, fix the ones
that present a failure as none or invite a wrong action, and guard the precise shape found.

## Design

Fix TeamPasswordsDialog and AddAgentDialog (failed state, not empty list); SessionDetailView per-part failures (review:
hold the paid generate; summary: say so; why: hide the composer). Guard: `else set…([]|0|false)` after an `.ok` check.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T20:56:34Z",
    "why_it_governs": "Understand before building: the residual named spellings the guard misses; 158 `.catch(() => null)` on fetch are not themselves wrong — what matters is what the code does after a null/non-OK response, so ~40 fetch sites were read in context.",
    "how_this_build_will_embody_it": "Only sites that turn a failure into a false 'none' or a wrong action are changed."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T20:56:34Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T20:56:34Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T20:56:34Z",
    "why_it_governs": "Layer 3: a false 'none' invites the wrong next action (create a duplicate password, pay for a review that exists, append a second permanent read).",
    "how_this_build_will_embody_it": "Each fixed site says it couldn't load and holds the action until a refresh."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T20:56:34Z",
    "why_it_governs": "Holistic: the call page is shared by Sales Coach and Remote Sales; the summary card hides when it has nothing.",
    "how_this_build_will_embody_it": "Fixes are per part; the summary card now appears to say it failed rather than vanish."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T20:56:34Z",
    "why_it_governs": "Look past the task: grep alone can't judge these; the code after each catch decides.",
    "how_this_build_will_embody_it": "Sites read in context; most already had explicit failed states and were left alone."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T20:56:34Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "None: no migration or external config."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T20:56:34Z",
    "why_it_governs": "Whether a part loaded is decided once, where the response is read; the buttons and composer must consume that flag rather than re-guess from an empty value.",
    "how_this_build_will_embody_it": "partFailed is set in load() from each response; the generate button, the composer and the summary card all branch on it."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T20:56:34Z",
    "why_it_governs": "The rep's 'why' is append-only; a duplicate can't be removed.",
    "how_this_build_will_embody_it": "The composer is hidden when the existing read couldn't be loaded."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T20:56:34Z",
    "why_it_governs": "Legal erasure is the one deletion exception.",
    "how_this_build_will_embody_it": "Not touched."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T20:56:34Z",
    "why_it_governs": "Guide, don't overtake: the screen should not push an action based on missing data.",
    "how_this_build_will_embody_it": "Paid generate held; composer held; duplicate-inviting text replaced."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T20:56:34Z",
    "why_it_governs": "Honesty: a failed read is not an empty one.",
    "how_this_build_will_embody_it": "Three screens fixed; a third guard shape added."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T20:56:34Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No decision needed: the residual named the sweep."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T20:56:34Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T20:56:34Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T20:56:34Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Else-form guard in noFailedReadAsEmpty (fails on the old dialogs); render tests for the dialogs and the call page, each mutation-checked."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T20:56:34Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
