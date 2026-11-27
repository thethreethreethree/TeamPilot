---
started_at: 2026-11-27T01:28:00Z
trigger: Today's screens without render tests: CallContacts (the render-tests record's residual).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Render test for a call's contacts

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: one render test.
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: test today's screens as a person uses them.
- why-this-problem-exists: CallContacts had route tests only.
- record-consulted: CallContacts.tsx, the /:id/contacts route.
- conflicts-with-framework: NONE.
- ambiguities: NONE.

## FOUR-LAYER
1. build-structure: tests only.
2. operational-effect: pins taking someone off, the 404, the failure.
3. synergetic-comp: n/a.
4. surface: n/a.

## Session-read manifest

```json
[
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "182-205",
    "read_at": "2026-11-27T01:31:00Z",
    "why_it_governs": "Fail loud: a claim table that can't be written stops sends with a 500.",
    "how_this_build_will_embody_it": "claimErrors → 500."
  },
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-27T01:31:00Z",
    "why_it_governs": "Understand first: the close-date Save bug showed today's screens need their own render tests. Writing them for API keys and a deal's contacts found: revoking a key was one click and permanent; saving a contact's email re-posted the contact's role (an extra deal event each time) as a refresh.",
    "how_this_build_will_embody_it": "Revoke asks first; a plain reload replaces the re-post; render tests pin both."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-27T01:31:00Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "Read at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-27T01:31:00Z",
    "why_it_governs": "Holistic: the runner reuses listProspects (pinned), dealRisk, runAgent; drivers past and present share one rule.",
    "how_this_build_will_embody_it": "driversOf behind dealDrivers and driversFromSnapshots."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "92-150",
    "read_at": "2026-11-27T01:31:00Z",
    "why_it_governs": "Layer 4 / 2: an irreversible action (revoke) gets a confirm.",
    "how_this_build_will_embody_it": "Two-step revoke."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "152-180",
    "read_at": "2026-11-27T01:31:00Z",
    "why_it_governs": "Proactive review of today's changes; a test also caught a swapped-argument bug in the rewrite before commit.",
    "how_this_build_will_embody_it": "Test-first on the rewritten scan."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "260-280",
    "read_at": "2026-11-27T01:31:00Z",
    "why_it_governs": "One matcher: which wordings are 'the same topic' is market.ts topicKey; SQL never re-derives it.",
    "how_this_build_will_embody_it": "The route computes the members with topicKey; the SQL only blanks the ones it is given."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "290-300",
    "read_at": "2026-11-27T01:31:00Z",
    "why_it_governs": "Events are immutable, so a junk event is permanent noise in the deal's history.",
    "how_this_build_will_embody_it": "Saving an email no longer writes a deal event."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "324-340",
    "read_at": "2026-11-27T01:31:00Z",
    "why_it_governs": "Agents act once per close date; the editor says it's checked each night.",
    "how_this_build_will_embody_it": "Editor copy."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "302-316",
    "read_at": "2026-11-27T01:31:00Z",
    "why_it_governs": "Legal erasure must reach every stored copy, including a retired group version the company can still read.",
    "how_this_build_will_embody_it": "Retirements are no longer filtered out."
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "318-322",
    "read_at": "2026-11-27T01:31:00Z",
    "why_it_governs": "Nothing half-understood: a day with no record says so, never 'no warnings'.",
    "how_this_build_will_embody_it": "recorded: false → 'Nothing was recorded on …'."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "420-470",
    "read_at": "2026-11-27T01:31:00Z",
    "why_it_governs": "The checklist before acting.",
    "how_this_build_will_embody_it": "Run in this record."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-459",
    "read_at": "2026-11-27T01:31:00Z",
    "why_it_governs": "The methodology document must be read from the working tree this session, not recalled from cached labels.",
    "how_this_build_will_embody_it": "The teardown, evidence and migrations named in UNDERSTANDING were opened this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-27T01:31:00Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-27T01:31:00Z",
    "why_it_governs": "Views need security_invoker, or they read past RLS.",
    "how_this_build_will_embody_it": "accounts_current and contacts_current are security_invoker."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-800",
    "read_at": "2026-11-27T01:31:00Z",
    "why_it_governs": "Schema-complete isn't built: agents need a writer, a trigger point and a surface.",
    "how_this_build_will_embody_it": "Engage → Agents writes them; a stage change on a deal runs them; runs are listed."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-27T01:31:00Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
