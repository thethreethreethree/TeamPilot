---
started_at: 2026-11-25T01:34:36Z
trigger: Second independent review of commits d3b67ea2..0404601d.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Fixes from the second review

## The record (each re-read before fixing)

1. /status: llmReady/email/webhooks mean configured, not working; the page said "Working" / "All systems working".
2. CSV validated roles with isInvitableRole ('Lead' allowed); set-role with isAssignableOrgRole; setMemberRole checked none.
3. planImport: roleFrom null meant both "no change" and "was null" → a member with no role never got one.
4. KPI labels read the button state; loadMe had no latest-request guard; CSV mixed windows unlabelled.
5. Coaching rows came from feedback/listened keys only → a response-time-only manager had no row.
6. KPI growth summary didn't say its window under a period.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-25T01:34:37Z",
    "why_it_governs": "A second independent review (commits d3b67ea2..0404601d) found six problems; each was re-read in the code before fixing.",
    "how_this_build_will_embody_it": "Each fix targets the confirmed cause."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-25T01:34:37Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-25T01:34:37Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T01:34:37Z",
    "why_it_governs": "Holistic: the role rules, the KPI labels and the coaching rows each had two places that had to agree.",
    "how_this_build_will_embody_it": "Role validity moves into setMemberRole; KPI labels read the response; panel rows include every computed column's people."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T01:34:37Z",
    "why_it_governs": "Layer 2: a status page that says 'Working' during an AI outage, or a KPI label that names the wrong period, misleads the reader.",
    "how_this_build_will_embody_it": "Status says only what was tested; KPI shows only the latest request, labelled from the data."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-25T01:34:37Z",
    "why_it_governs": "Look past the task: the KPI CSV export mixed windows unlabelled.",
    "how_this_build_will_embody_it": "A Window column."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-25T01:34:37Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "The status page separates 'switched on' (config) from 'working' (tested)."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-25T01:34:37Z",
    "why_it_governs": "Which roles may be set is a decision with one home.",
    "how_this_build_will_embody_it": "isAssignableOrgRole inside setMemberRole; both callers inherit it."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-25T01:34:37Z",
    "why_it_governs": "Honesty: never claim more than was checked.",
    "how_this_build_will_embody_it": "'No problems detected' instead of 'All systems working'; 'Switched on' instead of 'Working' for unprobed parts."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-25T01:34:37Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "None needed: fixes restore intended behaviour."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-25T01:34:37Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-25T01:34:37Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-25T01:34:37Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Tests for the status wording, the role refusal, the null-role change and the response-only row."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-25T01:34:37Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
