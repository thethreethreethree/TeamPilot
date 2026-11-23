---
started_at: 2026-11-23T08:30:00Z
trigger: Residual filed by the stage-training build (docs/residuals/OPEN.md "11 client reads map a failed fetch to null") under the founder's standing "keep building everything in the list".
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Failed reads shown as "none" (the null form)

## The record

- noFailedReadAsEmpty.test.ts (2026-11-23) bans `r.ok ? r.json() : { x: null | [] | false }` but not
  `r.ok ? r.json() : null`; the stage-training build counted 12 in src/components.
- Each was read in context: RepArena showed "No coached pitches yet" on a failed points read; MyProgress hid itself;
  the call page's dissect and saved Ask Coach chats looked absent; TrainingManager's Assign picker and the Pipeline's
  "Whose pipeline" list were silently empty. The rest only label things (names, a greeting, the voice badge).

## Outside view

A guard that covers half the tree is a promise it can't keep; the first run over src/app should be expected to find
more. A label read failing is decoration missing; a data read failing as "none" is a false statement.

## Design

1. Fix every data read: reject non-OK, show "Couldn't load …".
2. Extend the guard to the null form across src/components and src/app, with a per-file count allowlist for label reads
   (and a check that fails on a spare allowance).

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T08:36:12Z",
    "why_it_governs": "Understand before fixing: each of the 18 null-mapped reads was read in context to see what it renders on failure.",
    "how_this_build_will_embody_it": "Seven showed a false 'none' or hid data and were fixed; eight only label things and are listed with why."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T08:36:12Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T00:15:03Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T08:36:12Z",
    "why_it_governs": "Layer 3: a failed read that looks like 'none' sends the person the wrong way (e.g. 'isn't assigned to you').",
    "how_this_build_will_embody_it": "Each fixed read now says it couldn't load, most with a refresh hint."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T08:36:12Z",
    "why_it_governs": "Holistic: a sweep across six screens must not change what they show when reads succeed.",
    "how_this_build_will_embody_it": "Only the failure branch changed in each; the successful path is untouched; the full suite passes."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T08:36:12Z",
    "why_it_governs": "Look past the task: the first sweep searched src/components only.",
    "how_this_build_will_embody_it": "The new guard covers src/app too and found 7 more on its first run; fixed or listed."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T08:36:12Z",
    "why_it_governs": "External config can hide a feature's failure.",
    "how_this_build_will_embody_it": "None involved: client fetches only."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T08:36:12Z",
    "why_it_governs": "One rule for what counts as a failed read.",
    "how_this_build_will_embody_it": "The guard test is the rule: a non-OK response must reject; exceptions are counted per file with a reason."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T08:36:12Z",
    "why_it_governs": "A read-only sweep must not quietly become a write path; confirmed none of the touched code writes anything.",
    "how_this_build_will_embody_it": "Not touched: reads only."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T08:36:12Z",
    "why_it_governs": "Legal erasure is the one deletion exception.",
    "how_this_build_will_embody_it": "Not touched."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T08:36:12Z",
    "why_it_governs": "A failure message must state a fact, not steer the person into an action such as re-running a paid review.",
    "how_this_build_will_embody_it": "Not affected: messages only state that something didn't load."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T08:36:12Z",
    "why_it_governs": "Honesty: 'No coached pitches yet' for a rep with points is a false statement.",
    "how_this_build_will_embody_it": "Failures now say 'Couldn't load'; the Command Center adds C.A.R.E to its existing load-error banner."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T08:36:12Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No decision: this closes a filed residual."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T08:36:12Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T08:36:12Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T08:36:12Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "noFailedReadAsEmpty now fails on the null form anywhere in src/components or src/app, and on a spare allowance."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T08:36:12Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
