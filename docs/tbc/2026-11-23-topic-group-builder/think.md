---
started_at: 2026-11-23T20:42:24Z
trigger: Founder 2026-11-23 "keep building everything in the list" — OPEN.md market "a manager can edit an AI suggestion but not build a topic group from scratch".
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Make and edit topic groups by hand

## The record

- topic-groups POST accepts { name, members, source: "manager", replaces } and checks members against candidates().
- The panel only offered AI suggestions and Ungroup.

## Outside view

If the AI misses a split, the manager's only recourse was asking again. A manager must be able to group what they see,
and fix a group without losing it first.

## Design

GET topic-groups?candidates=1&module=&editing= (managers) → candidates; TopicGroups "Make a group" / "Edit" form with
name, topic search and checkboxes; save → POST (source manager; replaces on edit).

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T20:43:35Z",
    "why_it_governs": "Understand before building: the topic-groups build left 'a manager can edit an AI suggestion but not build a group from scratch'; the save route already accepts source 'manager' and 'replaces'.",
    "how_this_build_will_embody_it": "Only a candidate list and a form are new; saving uses the existing checked route."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T20:43:35Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T20:43:35Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T20:43:35Z",
    "why_it_governs": "Layer 3: a manager who sees a split the AI missed should fix it in the same panel; an existing group should be correctable without ungroup-and-rebuild.",
    "how_this_build_will_embody_it": "'Make a group' beside 'Suggest groups'; 'Edit' beside 'Ungroup', opening with the group's topics ticked."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T20:43:35Z",
    "why_it_governs": "Holistic: the form must not offer a topic the save would refuse.",
    "how_this_build_will_embody_it": "Candidates come from the same rule (topicSuggest.candidates) the POST check uses, excluding other groups but including the one being edited."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T20:43:35Z",
    "why_it_governs": "Look past the task: stored members are lower-cased wordings; the list shows display names.",
    "how_this_build_will_embody_it": "Ticked state is matched by topicKey, so an edit opens with the right topics; tested."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T20:43:35Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "None: no migration or external config."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T20:43:35Z",
    "why_it_governs": "'May be grouped' has one rule.",
    "how_this_build_will_embody_it": "candidates() is used by the GET list and the POST check alike."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T20:43:35Z",
    "why_it_governs": "Editing a group must not overwrite the old one.",
    "how_this_build_will_embody_it": "Edit saves a new group with replaces → a retirement row for the old."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T20:43:35Z",
    "why_it_governs": "Legal erasure is the one deletion exception.",
    "how_this_build_will_embody_it": "Same members rule as before (2+ calls); the erasure residual stays open."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T20:43:35Z",
    "why_it_governs": "Guide, don't overtake: the manager decides groups; the AI is one way in, not the only one.",
    "how_this_build_will_embody_it": "A manual path with no AI call."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T20:43:35Z",
    "why_it_governs": "Honesty: a group the manager can't see the contents of would hide what was merged.",
    "how_this_build_will_embody_it": "The group's topics are listed and editable."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T20:43:35Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No decision needed: within the founder's 'AI suggests, manager OKs' (the manager decides)."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T20:43:35Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T20:43:35Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T20:43:35Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Route test: candidate list honours other groups and the edited one; render tests: make and edit post the right body."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T20:43:35Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
