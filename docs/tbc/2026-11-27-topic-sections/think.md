---
started_at: 2026-11-26T23:48:00Z
trigger: Gong P1/P2 gap audit F11.11; founder picker 2026-11-27 "On request per call" (and F12.8 "Managers only").
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Topic sections on a call, on request

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: topicSections.ts; topicSectionsCoach; /api/coach/remote/:id/topic-sections; TopicSections on the call page; tests.
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: build F11.11 as the founder chose: on request, per call.
- why-this-problem-exists: calls had topics (intel) and key moments, but no split of the call by topic.
- record-consulted: the gap audit, custom-brief route (the on-request pattern), salesIntel.ts (events as the store), followThrough loadLines/numberedTranscript, SessionDetailView, 0348/0349/0350.
- conflicts-with-framework: NONE.
- ambiguities: NONE.

## FOUR-LAYER
1. build-structure: one pure parser, one route, one component; no table.
2. operational-effect: one click → sections kept for that transcript.
3. synergetic-comp: each section seeks the call's player.
4. surface: a bar by share and a list with times.

## Session-read manifest

```json
[
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "182-205",
    "read_at": "2026-11-27T00:13:00Z",
    "why_it_governs": "Fail loud: a claim table that can't be written stops sends with a 500.",
    "how_this_build_will_embody_it": "claimErrors → 500."
  },
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-27T00:13:00Z",
    "why_it_governs": "Understand first: F11.11 (topic sections on the timeline) was the gap; founder picker 2026-11-27: 'On request per call' — one paid AI read only when someone asks.",
    "how_this_build_will_embody_it": "A button on the call page runs it once per transcript version; the result is kept and reused."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-27T00:13:00Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "Read at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-27T00:13:00Z",
    "why_it_governs": "Holistic: the split is an event on the call, so erasure (0350, by subject) and call access (0348) already cover it.",
    "how_this_build_will_embody_it": "No new table: kind coach.session_topic_sections, subject sales_session:<id>."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "92-150",
    "read_at": "2026-11-27T00:13:00Z",
    "why_it_governs": "Layer 4: brand tones only (no red/green), each band with its label and share.",
    "how_this_build_will_embody_it": "BAND tones + text."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "152-180",
    "read_at": "2026-11-27T00:13:00Z",
    "why_it_governs": "Proactive review of today's changes; a test also caught a swapped-argument bug in the rewrite before commit.",
    "how_this_build_will_embody_it": "Test-first on the rewritten scan."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "260-280",
    "read_at": "2026-11-27T00:13:00Z",
    "why_it_governs": "One loader and one access path: loadLines and getSession through the caller's client.",
    "how_this_build_will_embody_it": "Hidden calls and the tree apply exactly as for briefs."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "290-300",
    "read_at": "2026-11-27T00:13:00Z",
    "why_it_governs": "Append-only: a new split for a new transcript version is a new event.",
    "how_this_build_will_embody_it": "Keyed by transcript_version in the payload."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "324-340",
    "read_at": "2026-11-27T00:13:00Z",
    "why_it_governs": "A factual read of what was discussed, not advice.",
    "how_this_build_will_embody_it": "Neutral labels; never names, numbers or quotes."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "302-316",
    "read_at": "2026-11-27T00:13:00Z",
    "why_it_governs": "Erasure reaches it: a call's events are deleted by subject.",
    "how_this_build_will_embody_it": "Stored only as a call event."
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "318-322",
    "read_at": "2026-11-27T00:13:00Z",
    "why_it_governs": "Nothing half-understood: sections must cover real, consecutive lines; the first bad one ends the read; under two is nothing.",
    "how_this_build_will_embody_it": "parseSections."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "420-470",
    "read_at": "2026-11-27T00:13:00Z",
    "why_it_governs": "The checklist before acting.",
    "how_this_build_will_embody_it": "Run in this record."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-459",
    "read_at": "2026-11-27T00:13:00Z",
    "why_it_governs": "The methodology document must be read from the working tree this session, not recalled from cached labels.",
    "how_this_build_will_embody_it": "The teardown, evidence and migrations named in UNDERSTANDING were opened this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-27T00:13:00Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-27T00:13:00Z",
    "why_it_governs": "Views need security_invoker, or they read past RLS.",
    "how_this_build_will_embody_it": "accounts_current and contacts_current are security_invoker."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-800",
    "read_at": "2026-11-27T00:13:00Z",
    "why_it_governs": "Schema-complete isn't built: agents need a writer, a trigger point and a surface.",
    "how_this_build_will_embody_it": "Engage → Agents writes them; a stage change on a deal runs them; runs are listed."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-27T00:13:00Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
