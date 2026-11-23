---
started_at: 2026-11-23T21:23:35Z
trigger: OPEN.md forecast "no what-if (move a deal's date and see the months change)" (left open by docs/tbc/2026-11-23-forecast-quarters).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Forecast what-if

## The record

- ByCloseMonth renders forecastByMonth(prospects); dates come from the saved 'close_date' events.

## Outside view

Forecast conversations are "what if this slips". Exploring must never rewrite the record.

## Design

withMovedDates (pure copy); a "What if?" mode in ByCloseMonth listing open deals with date inputs, labelled "on
screen only, nothing is saved", with "Back to the real dates".

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T21:24:27Z",
    "why_it_governs": "Understand before building: the forecast-quarters build left 'no what-if — move a deal's date on screen and see the months change'; forecastByMonth is pure, so a moved copy can be recomputed.",
    "how_this_build_will_embody_it": "A copy of the deals with moved dates feeds the same function; nothing new is computed."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T21:24:27Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T21:24:27Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T21:24:27Z",
    "why_it_governs": "Layer 3: 'what if Acme slips to January?' should be answerable without changing Acme's real date.",
    "how_this_build_will_embody_it": "A what-if list of open deals with date inputs above the same table."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T21:24:27Z",
    "why_it_governs": "Holistic: the real expected dates feed risk, the Ask box and the forecast cards.",
    "how_this_build_will_embody_it": "The what-if affects only this table, on a copy; the cards above and saved dates are untouched."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T21:24:27Z",
    "why_it_governs": "Look past the task: a what-if that saved would rewrite the rep's own forecast without them.",
    "how_this_build_will_embody_it": "No request is made; tested that nothing is POSTed."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T21:24:27Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "None: no migration or external config."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T21:24:27Z",
    "why_it_governs": "A second, what-if-only calculation would drift from the real forecast; the what-if must run the same function on different inputs.",
    "how_this_build_will_embody_it": "withMovedDates feeds forecastByMonth; no second calculation."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T21:24:27Z",
    "why_it_governs": "A what-if must not become a fact.",
    "how_this_build_will_embody_it": "Never stored; leaving the mode restores the real dates."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T21:24:27Z",
    "why_it_governs": "Legal erasure is the one deletion exception.",
    "how_this_build_will_embody_it": "Not touched."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T21:24:27Z",
    "why_it_governs": "Guide, don't overtake: the person explores; the system never moves a deal's real date.",
    "how_this_build_will_embody_it": "Banner 'on screen only, nothing is saved'; 'Back to the real dates'."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T21:24:27Z",
    "why_it_governs": "Honesty: a what-if number must never be mistaken for the forecast.",
    "how_this_build_will_embody_it": "The what-if is labelled while on; the real forecast returns on leaving it."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T21:24:27Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No decision needed: the residual named the build."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T21:24:27Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T21:24:27Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T21:24:27Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "withMovedDates unit test (copy only); render test (table changes, no POST, back restores)."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T21:24:27Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
