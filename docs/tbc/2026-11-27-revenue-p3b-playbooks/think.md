---
started_at: 2026-11-26T20:59:00Z
trigger: Revenue build plan Phase 3 part b (docs/ELOSTATE-REVENUE-BUILD-PLAN/docs/07-BUILD-ORDER.md): playbooks and the AI Deal Reviewer, right after 3a shipped (c5cd8ecd).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Revenue Phase 3b: playbooks and the AI Deal Reviewer

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: the company playbook (MEDDICC, BANT, SPICED or custom), note events per deal element, the AI reviewer over a deal's latest calls, the deal panel's letters, the board's Playbook column, erasure.
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: Gong F20.6 (methodology playbooks, a letter per element on each deal) and F20.7 (the AI Deal Reviewer: each element mapped to evidence from the calls, the AE writes a note, the AE or a manager validates; four visible states).
- why-this-problem-exists: deals had no methodology layer at all. Nothing asked whether budget, authority, need or timeline were known, and no AI read the deal's calls as a whole (Ask across a pipeline answers questions, but writes no notes).
- record-consulted: briefTemplates.ts / briefTemplatesRun.ts (the cited-evidence discipline), claude.ts customBriefCoach (controlExempt, the on-click precedent), followThrough.ts (loadLines, numberedTranscript), 0364 (brief erasure), 0323 and 0370 (erasure bodies), the teardown's F20.6 and F20.7.
- conflicts-with-framework: NONE.
- ambiguities: R10 (which playbooks ship). The plan's stand-in: MEDDICC, BANT, SPICED and custom, in our own wording.

## FOUR-LAYER
1. build-structure: notes are append-only events; the replay is the one rule; the AI read is stored only with a cited line.
2. operational-effect: a manager picks a playbook; a rep runs "Review with AI" on a deal, sees evidence with links to the lines, writes the note; the manager validates.
3. synergetic-comp: the letters appear on the Board for every deal, so a pipeline review sees which deals lack a known budget or decision-maker; citations open the call at the line.
4. surface: four states in form and in words (aria-label and title), the app's tokens.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T21:06:00Z",
    "why_it_governs": "Understanding first: Gong's playbooks and AI Deal Reviewer (F20.6, F20.7) are letters per deal with AI evidence a person writes up and a manager validates; read from the teardown before code.",
    "how_this_build_will_embody_it": "playbook.ts encodes exactly that flow, with tests."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T21:06:00Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "Read at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T21:06:00Z",
    "why_it_governs": "Holistic: notes and AI reads quote customers, so erasure, the board, the deal panel and the AI cost path all change together.",
    "how_this_build_will_embody_it": "rss_erase_sessions and rss_erase_prospects blank them; the board shows the letters; the reviewer uses the call() wrapper."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "92-150",
    "read_at": "2026-11-26T21:06:00Z",
    "why_it_governs": "Four layers, foundation up.",
    "how_this_build_will_embody_it": "FOUR-LAYER block above."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "152-180",
    "read_at": "2026-11-26T21:06:00Z",
    "why_it_governs": "Audit the neighbours while building.",
    "how_this_build_will_embody_it": "check.md covers erasure, RLS and the tree."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "260-280",
    "read_at": "2026-11-26T21:06:00Z",
    "why_it_governs": "One authority for a note's state: the replay; a race or stale screen can't put a note in a state the rules don't allow.",
    "how_this_build_will_embody_it": "replayNotes ignores disallowed actions; the route and the list both consume it."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "290-300",
    "read_at": "2026-11-26T21:06:00Z",
    "why_it_governs": "Events are immutable: every note action is a row, the current note is a replay.",
    "how_this_build_will_embody_it": "deal_element_notes has no update or delete except erasure."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "324-340",
    "read_at": "2026-11-26T21:06:00Z",
    "why_it_governs": "Guide, don't overtake: the AI suggests, a person writes the note, the owner or a manager validates.",
    "how_this_build_will_embody_it": "validate needs a written note; the AI can't validate or overwrite a person's note."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "302-316",
    "read_at": "2026-11-26T21:06:00Z",
    "why_it_governs": "Erasure must reach every stored copy of the customer's words, including AI reads and notes.",
    "how_this_build_will_embody_it": "Both erasure functions blank them; rows kept; the probe shows 0 text left."
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "318-322",
    "read_at": "2026-11-26T21:06:00Z",
    "why_it_governs": "Nothing half-understood reaches a person: an AI read with no cited line is 'not found', never a guess.",
    "how_this_build_will_embody_it": "parseReview drops uncited answers; only cited evidence is stored."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "420-470",
    "read_at": "2026-11-26T21:06:00Z",
    "why_it_governs": "The checklist before acting.",
    "how_this_build_will_embody_it": "Run in this record."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-459",
    "read_at": "2026-11-26T21:06:00Z",
    "why_it_governs": "The methodology document must be read from the working tree this session, not recalled from cached labels.",
    "how_this_build_will_embody_it": "The teardown, evidence and migrations named in UNDERSTANDING were opened this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T21:06:00Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T21:06:00Z",
    "why_it_governs": "Views need security_invoker, or they read past RLS.",
    "how_this_build_will_embody_it": "accounts_current and contacts_current are security_invoker."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-800",
    "read_at": "2026-11-26T21:06:00Z",
    "why_it_governs": "Schema-complete isn't built: each new table needs a writer and a surface.",
    "how_this_build_will_embody_it": "deal_playbooks: the Playbook picker; deal_element_notes: the deal panel and the reviewer; read by the panel and the board."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T21:06:00Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
