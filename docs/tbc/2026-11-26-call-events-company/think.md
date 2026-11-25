---
started_at: 2026-11-25T23:35:52Z
trigger: docs/residuals/OPEN.md 2026-11-26 · call-events-access — 233 call events stamped with other companies.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - An event about a call carries the call's company

## Design

0349: rss_events_company_from_call (definer) BEFORE INSERT on events — for sales_session:<uuid> / pitch:<uuid>, set
company_id to the call's / score's company. Stored rows untouched.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-25T23:35:53Z",
    "why_it_governs": "Verifying 0348 found 233 production events about one company's calls stamped with four other companies; record_event stamps the author's company at write time, so an author who changes company leaves call events under the wrong tenant.",
    "how_this_build_will_embody_it": "A BEFORE INSERT trigger stamps call/score events with the call's own company."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-25T23:35:53Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "Sections printed by line at 2026-11-25T23:35:53Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T23:35:53Z",
    "why_it_governs": "Holistic: every events insert passes the trigger; most subjects are not calls.",
    "how_this_build_will_embody_it": "Only sales_session:/pitch: subjects with a well-formed id are looked up (one PK read); others pass through."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T23:35:53Z",
    "why_it_governs": "Layer 2: legitimate writes (a rep on their own call, a manager on a report's) must keep working.",
    "how_this_build_will_embody_it": "Replay: the rep's own write accepted; unrelated events accepted."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-25T23:35:53Z",
    "why_it_governs": "Look past the task: a signed-in writer from another company should not be able to file an event against a call.",
    "how_this_build_will_embody_it": "With the call's company stamped, events' WITH CHECK refuses it (replayed)."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-25T23:35:53Z",
    "why_it_governs": "The fix depends on 0349 in production.",
    "how_this_build_will_embody_it": "db:apply applied 0349; verify:live 33 hold."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-25T23:35:53Z",
    "why_it_governs": "A call's company is decided by the call row.",
    "how_this_build_will_embody_it": "The trigger reads it from coaching_sessions / pitch_scores; nothing re-derived."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-25T23:35:53Z",
    "why_it_governs": "Events are append-only; the 233 stored rows can't be edited by this change.",
    "how_this_build_will_embody_it": "Insert-time only; the stored rows are left for the founder."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-25T23:35:53Z",
    "why_it_governs": "Erasure deletes call events by subject and company; a mis-stamped event could escape a company-pinned erasure.",
    "how_this_build_will_embody_it": "New call events carry the call's company, so erasure's company pin finds them."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-25T23:35:53Z",
    "why_it_governs": "What to do with the 233 existing rows is the founder's call.",
    "how_this_build_will_embody_it": "Recorded in OPEN.md, not changed."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-25T23:35:53Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "The stored-row correction is deferred to the founder."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-25T23:35:53Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-25T23:35:53Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id was printed at the given line range this session."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-25T23:35:53Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "hideCoverage test asserts the trigger and its two lookups."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-25T23:35:53Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
