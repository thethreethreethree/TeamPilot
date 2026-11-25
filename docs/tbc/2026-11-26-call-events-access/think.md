---
started_at: 2026-11-25T23:29:26Z
trigger: Founder picker 2026-11-26 — "Follow the call's access" for a call's AI reads in events.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - A call's AI reads follow the call's access

## Design

0348: restrictive SELECT rule on events — subjects 'sales_session:<id>' visible only if that coaching_session is
readable by the caller, 'pitch:<id>' only if that pitch_score is; other events unchanged. Uncorrelated subqueries.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-25T23:29:27Z",
    "why_it_governs": "events are readable company-wide, so a rep could read a teammate's call's AI summaries and dispute notes for calls they can't open; measured on production: a rep with no calls could read 1,330 call events. Founder picker 2026-11-26: 'Follow the call's access'.",
    "how_this_build_will_embody_it": "A restrictive rule: an event about a call or score is readable only by someone who can read that call or score."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-25T23:29:27Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "Sections printed by line at 2026-11-25T23:29:27Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T23:29:27Z",
    "why_it_governs": "Holistic: 63 files read events; any that show a rep other people's call events would change.",
    "how_this_build_will_embody_it": "Every caller-client reader checked fetches the calls through RLS first (market, search, dashboard reads own events); service-role readers are unaffected."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T23:29:27Z",
    "why_it_governs": "Layer 2: an events read must stay fast — it backs many screens.",
    "how_this_build_will_embody_it": "Set-based subqueries; production timing 126 → 139 ms for a manager's 1,330 call events (rolled back before applying)."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-25T23:29:27Z",
    "why_it_governs": "Look past the task: call content also lives under 'pitch:<id>' subjects (dispute notes).",
    "how_this_build_will_embody_it": "Both subject forms follow their table's read rule."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-25T23:29:27Z",
    "why_it_governs": "The change depends on 0348 in production.",
    "how_this_build_will_embody_it": "db:apply applied 0348; verify:live 33 hold."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-25T23:29:27Z",
    "why_it_governs": "Who may read a call is decided by coaching_sessions' and pitch_scores' own rules.",
    "how_this_build_will_embody_it": "The policy reads those tables under the caller's rules; nothing re-derived."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-25T23:29:27Z",
    "why_it_governs": "Events are append-only; access narrows without touching them.",
    "how_this_build_will_embody_it": "A read rule only."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-25T23:29:27Z",
    "why_it_governs": "Erasure deletes call events; this rule doesn't affect that path (service role).",
    "how_this_build_will_embody_it": "Unaffected."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-25T23:29:27Z",
    "why_it_governs": "The scope was the founder's choice.",
    "how_this_build_will_embody_it": "Picker answered 2026-11-26."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-25T23:29:27Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "Asked as a picker with a recommendation."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-25T23:29:27Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-25T23:29:27Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id was printed at the given line range this session."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-25T23:29:27Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "hideCoverage test fails if the events rule is dropped or loses either subject form."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-25T23:29:27Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
