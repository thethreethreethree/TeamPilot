---
started_at: 2026-11-23T11:08:00Z
trigger: Founder 2026-11-23 "keep building everything in the list" — ledger F14.6 "Market page" (LACK: intel extracted per call, never added up or tied to outcomes).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Market: competitors and topics across calls

## The record

- salesIntel.ts writes coach.session_intel_generated per call: payload { intel: { competitors, topics } }; competitors
  are kept only if they appear in the transcript (groundCompetitors).
- Production (read-only, 2026-11-23): 316 such events, 8 companies, 174 naming a competitor.
- Outcomes on coaching_sessions: sold / no_sale / follow_up / no_contact / undecided.

## Outside view

A market page misleads if it double-counts a competitor named twice on one call, mixes meetings in, reads a stale
version of a call's intel, or prints a win rate from a handful of calls.

## Design

market.ts computeMarket (grouped names, once per call, share, weekly, win rate with a 5-closed floor; topics);
GET /api/coach/remote/market (caller's client, sales calls, latest intel per call, paged, fail loud); Remote Sales →
Market (managers).

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T11:14:59Z",
    "why_it_governs": "Understand before building: where per-call intel lives (coach.session_intel_generated: {intel:{competitors,topics}}), its grounding rule and how much production holds were read first.",
    "how_this_build_will_embody_it": "Production read-only: 316 intel events across 8 companies, 174 naming a competitor; payload shape confirmed before parsing."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T11:14:59Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T00:15:03Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T11:14:59Z",
    "why_it_governs": "Layer 2: the per-call intel was collected but never added up, so nobody could see which competitors matter.",
    "how_this_build_will_embody_it": "Market: competitors with calls, share, weekly bars and win rate when named; top topics."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T11:14:59Z",
    "why_it_governs": "Holistic: Market spans every sales call in view, so meetings and other modules must not leak in.",
    "how_this_build_will_embody_it": "Sales calls only (isSalesCall) of the module's contexts; the caller's own access decides whose calls."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T11:14:59Z",
    "why_it_governs": "Look past the task: a win rate from two calls would look decisive and mean nothing.",
    "how_this_build_will_embody_it": "No win rate below 5 closed calls, overall or per competitor; '—' with the rule stated."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T11:14:59Z",
    "why_it_governs": "External config can leave a view silently empty.",
    "how_this_build_will_embody_it": "None; existing events."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T11:14:59Z",
    "why_it_governs": "One counting rule for the market.",
    "how_this_build_will_embody_it": "computeMarket in market.ts; the route only reads."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T11:14:59Z",
    "why_it_governs": "Derived from the record, not stored.",
    "how_this_build_will_embody_it": "Computed on read from the latest intel event per call."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T11:14:59Z",
    "why_it_governs": "Legal erasure removes a call's intel events (0285).",
    "how_this_build_will_embody_it": "An erased call's intel is gone, so Market no longer counts what it said; nothing new to erase."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T11:14:59Z",
    "why_it_governs": "Guide, don't overtake: market facts should inform the team's own judgement.",
    "how_this_build_will_embody_it": "Counts and rates only; no recommendation."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T11:14:59Z",
    "why_it_governs": "Honesty: a competitor named is a factual claim.",
    "how_this_build_will_embody_it": "Competitors are already grounded in the transcript by salesIntel; win rates need 5 closed calls."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T11:14:59Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No decision needed."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T11:14:59Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T11:14:59Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T11:14:59Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Grouping, once-per-call counting, the win-rate floor and fail-loud are tests."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T11:14:59Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
