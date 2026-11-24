---
started_at: 2026-11-24T20:08:19Z
trigger: Founder 2026-11-25 "it seems that the macro system did not follow the PDF I presented" (General Sales Interface for Elostate.pdf); picker "PDF screens + team section".
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Macro Mode follows the PDF for everyone

## The record

PDF re-read from source (EVIDENCE.md, 2026-11-25 section). Observed gaps:
1. Managers/admins in Macro Mode kept all tabs, the full pipeline and full Today (RemoteSalesShell, RemotePipeline,
   RemoteToday) — I had read "Manager User Flow: Nothing will change here" as "managers keep everything".
2. The Macro call page stacked stage chips, consent, a player with downloads/clips/trims and six stat tiles above the
   three tabs, in a phone-width column; the PDF's picture is tabs left, player and talk lanes right.
3. Remote Sales opened on Calls, not the brain dump "when they first open the software".
4. Prospects were stacked cards; the PDF's picture is a table, one column per field.

## Outside view

The founder is signed in as a manager, so every simplification built on 2026-11-24 was invisible to them: the build
was right for reps and looked like nothing changed.

## Design

macro === true is the only test on every Macro screen. Call page: two columns (lg), player simple (play, 15 s skips,
speed, lanes). Pipeline: SimpleTable (CSS-stacked on phones). Calls: first visit of the day → Today (localStorage, a
failure shows Calls). Everything else stays in the full view, one switch away.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-24T20:08:21Z",
    "why_it_governs": "The founder reported Macro Mode doesn't follow the PDF; before changing anything the PDF was re-read from source (text and every page image) and compared screen by screen with the code.",
    "how_this_build_will_embody_it": "Four observed gaps recorded in EVIDENCE.md, each fixed at its cause, not by adding more."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-24T20:08:21Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-24T20:08:21Z; the PDF opened from the founder's Downloads."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-24T20:08:21Z",
    "why_it_governs": "Holistic: the Macro switch is read by the shell, Pipeline, Today, Calls and the call page; changing who is simplified touches all of them and their tests.",
    "how_this_build_will_embody_it": "Every Macro reader now applies one rule (macro === true); the full view is unchanged with Macro Mode off; tests rewritten to the new rule."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-24T20:08:21Z",
    "why_it_governs": "Layer 3, workflow: the PDF's flow is brain dump on first open, Highlights → Coaching after a call, Next Meeting before the next one; a manager reviews reps' pipelines.",
    "how_this_build_will_embody_it": "First visit of the day lands on Today; the call page shows the tabs beside the player; managers keep Whose pipeline."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-24T20:08:21Z",
    "why_it_governs": "Look past the task: removing the stage chips would leave a just-uploaded call with empty tabs and no explanation.",
    "how_this_build_will_embody_it": "Stage chips stay in Macro Mode only while the call is processing or has failed."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-24T20:08:21Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "None: no migration or external config."
  },
  {
    "id": "§1.5.4",
    "source_file": "CLAUDE.md",
    "line_range": "198-210",
    "read_at": "2026-11-24T20:08:21Z",
    "why_it_governs": "The founder specified the interface (the PDF's screens, its picture's layout, 'nothing else') as the result; shipping a Macro Mode that a manager sees unchanged was the under-deliver failure.",
    "how_this_build_will_embody_it": "The layout and the 'nothing else' rule are built as the result for every role, not left as polish."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-24T20:08:21Z",
    "why_it_governs": "One verdict decides simple vs full: useRemoteMacroMode's enabled.",
    "how_this_build_will_embody_it": "Each screen branches on it directly; the role term that made managers an exception is gone."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-24T20:08:21Z",
    "why_it_governs": "Records are append-only: the decision log already holds the earlier reading that managers keep everything, and the spec holds the PDF quote it came from.",
    "how_this_build_will_embody_it": "The decision log and the spec get appended notes; the old decision row stays."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-24T20:08:21Z",
    "why_it_governs": "Guide, don't overtake: the manager reading reversed an earlier interpretation, so it went to the founder.",
    "how_this_build_will_embody_it": "Picker 'PDF screens + team section'; the three gaps the PDF settles were not asked."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-24T20:08:21Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "One picker, recommended option first."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-24T20:08:21Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-24T20:08:21Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-24T20:08:21Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Render tests pin each PDF rule per role: three tabs for a manager too, the six table columns, the simple player, Today on first open."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-24T20:08:21Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code; what was not seen in a browser is said."
  }
]
```
