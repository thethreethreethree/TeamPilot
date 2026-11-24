---
started_at: 2026-11-24T00:58:13Z
trigger: General Sales Interface PDF — Coaching "Harvard research on psychological effect on the wordings used to improve/motivate/inspire the users"; founder pickers "I'll find & you approve", then "Rules + cite 3 studies".
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Coaching wording grounded in research

## The record

- TONE_LAW (salesReviewPrompt.ts): strengths first, specific; growth as opportunity with a step; never lead with
  criticism; not a scorecard.
- Research (primary texts read; docs/rss/COACHING-WORDING-RESEARCH.md): no peer-reviewed Harvard study found;
  Kluger & DeNisi 1996, Mueller & Dweck 1998, Yeager et al. 2014 verified; Losada ratio invalid.

## Outside view

Citing "Harvard" to sound credible would be the overclaim the product's honesty is built against; three real studies
are a better boast.

## Design

TONE_LAW rules 5–7 with sources; a quiet cited line under the Coaching tab; the research on file.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-24T00:59:38Z",
    "why_it_governs": "Understand before building: the PDF asks for coaching wording grounded in 'Harvard research'; the existing TONE_LAW covers specific praise and opportunity framing; the research (primary texts read) found no peer-reviewed Harvard study, and three peer-reviewed ones.",
    "how_this_build_will_embody_it": "Only verified, peer-reviewed findings become rules and citations."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-24T00:59:38Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-24T00:59:38Z; the sources' primary texts read for every quote."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-24T00:59:38Z",
    "why_it_governs": "Layer 2: the founder specified research-grounded wording as part of the Coaching tab (§1.5.4 — a user-specified experience).",
    "how_this_build_will_embody_it": "The rules shape every 'did well' / 'to improve'; the tab names its sources."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-24T00:59:38Z",
    "why_it_governs": "Holistic: TONE_LAW is shared by the growth review and the dissect prompt.",
    "how_this_build_will_embody_it": "Both get the rules; nothing else in either prompt changes."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-24T00:59:38Z",
    "why_it_governs": "Look past the task: popular claims (the Losada ratio, 'criticism shuts the brain down') are disputed or invalid.",
    "how_this_build_will_embody_it": "Recorded as not used; a test forbids a ratio and a Harvard claim in the prompt."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-24T00:59:38Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "None: no migration or external config."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-24T00:59:38Z",
    "why_it_governs": "The wording rules live in one place.",
    "how_this_build_will_embody_it": "TONE_LAW in salesReviewPrompt.ts; the research doc points to it."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-24T00:59:38Z",
    "why_it_governs": "Coaching outputs are new records; old reviews keep their wording.",
    "how_this_build_will_embody_it": "Applies to reviews written from now on."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-24T00:59:38Z",
    "why_it_governs": "Legal erasure is the one deletion exception.",
    "how_this_build_will_embody_it": "Not touched."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-24T00:59:38Z",
    "why_it_governs": "Guide, don't overtake: the founder approved the rules and the citation line before anything shipped.",
    "how_this_build_will_embody_it": "Picker 'Rules + cite 3 studies'."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-24T00:59:38Z",
    "why_it_governs": "Honesty: claiming 'Harvard research' that couldn't be verified would be the confident false claim this project exists against.",
    "how_this_build_will_embody_it": "No Harvard claim; only verified peer-reviewed sources, with their caveats recorded."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-24T00:59:38Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "Picker after the research: founder chose 'Rules + cite 3 studies' (no Harvard claim)."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-24T00:59:38Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-24T00:59:38Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-24T00:59:38Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "salesReviewPrompt.researchRules.test.ts pins rules 5–7, their sources, and the absence of a Harvard claim and a ratio."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-24T00:59:38Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  },
  {
    "id": "§4",
    "source_file": "CLAUDE.md",
    "line_range": "414-426",
    "read_at": "2026-11-24T01:00:13Z",
    "why_it_governs": "Evolving the method: a new coaching rule counts as learned only when measured against the alternative on real outcomes; research elsewhere is a reason to try it, not proof it works here.",
    "how_this_build_will_embody_it": "The closure records that the wording's effect on reps is unmeasured in this product (residual R1-measure)."
  },
  {
    "id": "§1.5.4",
    "source_file": "CLAUDE.md",
    "line_range": "198-210",
    "read_at": "2026-11-24T01:00:13Z",
    "why_it_governs": "A user-specified experience is layer 2: the founder specified research-grounded, motivating wording as part of the Coaching tab, so it is the intended result, not optional polish.",
    "how_this_build_will_embody_it": "The rules shape every coaching output and the tab shows the sources; shipped as the result, not deferred."
  }
]
```
