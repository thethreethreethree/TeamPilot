---
started_at: 2026-11-26T23:50:00Z
trigger: Gong P1/P2 gap audit (2026-11-27): F5.7 "Six-hour cap" still partial (size cap only).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Six-hour recording cap

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: callCap.ts; useLiveCoaching (timer); audio-chunk route (409); tests.
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: build the Gong features still missing that need no outside service.
- why-this-problem-exists: capture was capped by bytes (TOO_LARGE), never by length.
- record-consulted: the gap audit, gong-teardown F5.7, session/state.ts, audio-chunk route (recStart → audio_started_at), useLiveCoaching start/stop/status, LiveCoachingPanel notRecordingBanner.
- conflicts-with-framework: NONE.
- ambiguities: NONE. Gong's number (six hours) is used as is.

## FOUR-LAYER
1. build-structure: one shared constant module.
2. operational-effect: the recorder stops at six hours; the server refuses audio past it.
3. synergetic-comp: reconnects keep the clock; a new call starts it again.
4. surface: the banner says why recording stopped.

## Session-read manifest

```json
[
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "182-205",
    "read_at": "2026-11-27T00:01:00Z",
    "why_it_governs": "Fail loud: a claim table that can't be written stops sends with a 500.",
    "how_this_build_will_embody_it": "claimErrors → 500."
  },
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-27T00:01:00Z",
    "why_it_governs": "Understand first: the Gong gap audit (P1/P2) lists F5.7 'six-hour cap' as partial — there is a 100 MB size cap but no length cap; a recorder left running keeps filling storage.",
    "how_this_build_will_embody_it": "A recorder stops itself at six hours and says why; the chunk route refuses audio past six hours (+15 min grace) from the recorder's own start."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-27T00:01:00Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "Read at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-27T00:01:00Z",
    "why_it_governs": "Holistic: the same recorder serves door and remote calls; a session can be created long before it records.",
    "how_this_build_will_embody_it": "The server counts from audio_started_at (set by chunk 0), never refusing while unknown."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "92-150",
    "read_at": "2026-11-27T00:01:00Z",
    "why_it_governs": "Layer 2/4: a stop the rep didn't make must say why.",
    "how_this_build_will_embody_it": "The not-recording banner shows CALL_CAP_MESSAGE."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "152-180",
    "read_at": "2026-11-27T00:01:00Z",
    "why_it_governs": "Proactive review of today's changes; a test also caught a swapped-argument bug in the rewrite before commit.",
    "how_this_build_will_embody_it": "Test-first on the rewritten scan."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "260-280",
    "read_at": "2026-11-27T00:01:00Z",
    "why_it_governs": "One matcher: which wordings are 'the same topic' is market.ts topicKey; SQL never re-derives it.",
    "how_this_build_will_embody_it": "The route computes the members with topicKey; the SQL only blanks the ones it is given."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "290-300",
    "read_at": "2026-11-27T00:01:00Z",
    "why_it_governs": "No stored data changes; refused audio is never written.",
    "how_this_build_will_embody_it": "409 before any storage write."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "324-340",
    "read_at": "2026-11-27T00:01:00Z",
    "why_it_governs": "Agents act once per close date; the editor says it's checked each night.",
    "how_this_build_will_embody_it": "Editor copy."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "302-316",
    "read_at": "2026-11-27T00:01:00Z",
    "why_it_governs": "No new copy of customer data.",
    "how_this_build_will_embody_it": "n/a"
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "318-322",
    "read_at": "2026-11-27T00:01:00Z",
    "why_it_governs": "Nothing half-understood: a day with no record says so, never 'no warnings'.",
    "how_this_build_will_embody_it": "recorded: false → 'Nothing was recorded on …'."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "420-470",
    "read_at": "2026-11-27T00:01:00Z",
    "why_it_governs": "The checklist before acting.",
    "how_this_build_will_embody_it": "Run in this record."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-459",
    "read_at": "2026-11-27T00:01:00Z",
    "why_it_governs": "The methodology document must be read from the working tree this session, not recalled from cached labels.",
    "how_this_build_will_embody_it": "The teardown, evidence and migrations named in UNDERSTANDING were opened this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-27T00:01:00Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-27T00:01:00Z",
    "why_it_governs": "Views need security_invoker, or they read past RLS.",
    "how_this_build_will_embody_it": "accounts_current and contacts_current are security_invoker."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-800",
    "read_at": "2026-11-27T00:01:00Z",
    "why_it_governs": "Schema-complete isn't built: agents need a writer, a trigger point and a surface.",
    "how_this_build_will_embody_it": "Engage → Agents writes them; a stage change on a deal runs them; runs are listed."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-27T00:01:00Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
