---
started_at: 2026-11-24T22:44:47Z
trigger: Gong ledger F23.8 "Dashboard team and period selectors" (P2, PARTIAL); founder picker 2026-11-25 "Outcome numbers only".
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - KPI period: 30 / 90 days / all time for the outcome numbers

## The record

/api/coach/kpi/me computes every metric over all in-person sessions; quota = this month; progression = first vs latest;
deltas = recent half vs prior half. The page has Company / Mine.

## Outside view

One switch that silently changes some numbers but not others misleads; each number must say its window.

## Design

period.ts (PERIOD_METRICS, parsePeriod, inPeriod). Route ?days= filters the outcome metrics and their deltas. Page:
All time / 90 days / 30 days; card notes say the window.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-24T22:44:48Z",
    "why_it_governs": "Ledger F23.8: the KPI page has a scope (Company / Mine) but no period; every number is all time while some carry their own window (quota this month, progression first-vs-latest).",
    "how_this_build_will_embody_it": "A period for the outcome numbers only, as the founder chose; the rest keep their windows and say so."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-24T22:44:48Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-24T22:44:48Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-24T22:44:48Z",
    "why_it_governs": "Holistic: each outcome card also shows a 'vs your earlier calls' delta, computed separately.",
    "how_this_build_will_embody_it": "The deltas for the period metrics use the same period rows, so a card never mixes windows."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-24T22:44:48Z",
    "why_it_governs": "Layer 2: a manager comparing this month's numbers needs them without last year's mixed in.",
    "how_this_build_will_embody_it": "All time / 90 days / 30 days beside Company / Mine; each card's note says its window."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-24T22:44:48Z",
    "why_it_governs": "Look past the task: a short period will leave more numbers 'still building' (minimum sessions).",
    "how_this_build_will_embody_it": "Unchanged gating; the cards say which window they use."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-24T22:44:48Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "None."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-24T22:44:48Z",
    "why_it_governs": "Which numbers follow the period is decided once.",
    "how_this_build_will_embody_it": "PERIOD_METRICS in period.ts, read by the route (filtering) and the page (labels)."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-24T22:44:48Z",
    "why_it_governs": "Guide, don't overtake: what the switch should change was the founder's decision.",
    "how_this_build_will_embody_it": "Picker 'Outcome numbers only'."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-24T22:44:48Z",
    "why_it_governs": "Honesty: a number must say what window it's over.",
    "how_this_build_will_embody_it": "Each card's note adds 'last N days', 'this month' or 'all time' when a period is chosen."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-24T22:44:48Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "The scope was a picker."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-24T22:44:48Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-24T22:44:48Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-24T22:44:48Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "period.test.ts pins that quota and progression never follow; the route test pins 30-day vs all-time revenue."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-24T22:44:48Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
