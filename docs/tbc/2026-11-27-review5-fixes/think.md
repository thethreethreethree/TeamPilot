---
started_at: 2026-11-27T00:28:00Z
trigger: Independent review of bb673124, 50ab05e5, 228a5470 and 05d96508 (2 medium, 6 low).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Review 5 fixes: the cap, the audit API, topic sections

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: callCap.ts; useLiveCoaching / useMeetingCoaching timers; audio-chunk route; publicApiRead audit; topicSections parser and route; SessionDetailView; tests.
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: fix what the review confirmed; stay on the build plans (updated in 43f752a3 with today's decisions).
- why-this-problem-exists: the cap was keyed on status and a clock; the audit resource copied the admin view's details to an outside reader; the split's share used the covered lines.
- record-consulted: the review report, both recorders (AUDIO_CHUNK_MS 15_000 each), the chunk route, recordAudit actions and meta, hidePhrases OUTSIDE_READER, topicSections.
- conflicts-with-framework: NONE.
- ambiguities: NONE. Low items left: a restart on the same session after the cap (the clean-Stop recording still saves); two simultaneous topic-section requests may both run (one read per version afterwards).

## FOUR-LAYER
1. build-structure: one cap rule, one meta filter.
2. operational-effect: a dropped call is capped; meetings are capped; nothing secret leaves the API.
3. synergetic-comp: the in-app audit view is unchanged (admins see everything).
4. surface: the cap message says the recording so far is kept; the topic note says how far the split covers.

## Session-read manifest

```json
[
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "182-205",
    "read_at": "2026-11-27T00:54:00Z",
    "why_it_governs": "Fail loud: a claim table that can't be written stops sends with a 500.",
    "how_this_build_will_embody_it": "claimErrors → 500."
  },
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-27T00:54:00Z",
    "why_it_governs": "Understand first: the review of bb673124 / 50ab05e5 / 228a5470 / 05d96508 found the cap never armed on a dropped call and its server backstop off when the recorder's start time is missing (meetings never send one); the audit API sent hide phrases, grant reasons, webhook URLs and hidden calls' ids; topic shares of a short split read as 100%; the button showed on non-sales calls.",
    "how_this_build_will_embody_it": "Cap armed on the recorder, server cap by chunk number (no clock), meetings capped too; audit rows of hidden calls dropped and free-text/secret keys withheld, cursor paging; shares of all lines sent; sales calls only; no digits in labels."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-27T00:54:00Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "Read at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-27T00:54:00Z",
    "why_it_governs": "Holistic: the meeting recorder shares the chunk route, so the server cap covers it too.",
    "how_this_build_will_embody_it": "Same MAX_CALL_CHUNK for both."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "92-150",
    "read_at": "2026-11-27T00:54:00Z",
    "why_it_governs": "Layer 4: brand tones only (no red/green), each band with its label and share.",
    "how_this_build_will_embody_it": "BAND tones + text."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "152-180",
    "read_at": "2026-11-27T00:54:00Z",
    "why_it_governs": "Proactive review of today's changes; a test also caught a swapped-argument bug in the rewrite before commit.",
    "how_this_build_will_embody_it": "Test-first on the rewritten scan."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "260-280",
    "read_at": "2026-11-27T00:54:00Z",
    "why_it_governs": "One cap rule (callCap.ts) for both recorders and the route.",
    "how_this_build_will_embody_it": "No second constant."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "290-300",
    "read_at": "2026-11-27T00:54:00Z",
    "why_it_governs": "Append-only: a new split for a new transcript version is a new event.",
    "how_this_build_will_embody_it": "Keyed by transcript_version in the payload."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "324-340",
    "read_at": "2026-11-27T00:54:00Z",
    "why_it_governs": "A factual read of what was discussed, not advice.",
    "how_this_build_will_embody_it": "Neutral labels; never names, numbers or quotes."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "302-316",
    "read_at": "2026-11-27T00:54:00Z",
    "why_it_governs": "The API must not export what a hide protects.",
    "how_this_build_will_embody_it": "OUTSIDE_READER rows dropped; AUDIT_META_WITHHELD."
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "318-322",
    "read_at": "2026-11-27T00:54:00Z",
    "why_it_governs": "Nothing half-understood: sections must cover real, consecutive lines; the first bad one ends the read; under two is nothing.",
    "how_this_build_will_embody_it": "parseSections."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "420-470",
    "read_at": "2026-11-27T00:54:00Z",
    "why_it_governs": "The checklist before acting.",
    "how_this_build_will_embody_it": "Run in this record."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-459",
    "read_at": "2026-11-27T00:54:00Z",
    "why_it_governs": "The methodology document must be read from the working tree this session, not recalled from cached labels.",
    "how_this_build_will_embody_it": "The teardown, evidence and migrations named in UNDERSTANDING were opened this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-27T00:54:00Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-27T00:54:00Z",
    "why_it_governs": "Views need security_invoker, or they read past RLS.",
    "how_this_build_will_embody_it": "accounts_current and contacts_current are security_invoker."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-800",
    "read_at": "2026-11-27T00:54:00Z",
    "why_it_governs": "Schema-complete isn't built: agents need a writer, a trigger point and a surface.",
    "how_this_build_will_embody_it": "Engage → Agents writes them; a stage change on a deal runs them; runs are listed."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-27T00:54:00Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
