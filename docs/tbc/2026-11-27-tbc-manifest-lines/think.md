---
started_at: 2026-11-27T02:27:00Z
trigger: The tbc:manifest gate's stale-range notes on every commit today named wrong lines (e.g. 3.1 "near line 251", a passing mention in the ground-up audit section; its heading is line 339).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - The manifest gate points at a section's heading

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: scripts/tbc/lib.mjs (idHomeLine, exactIdRe), verify-manifest.mjs, a test; the newest TBC manifest's ranges.
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: fix a real defect in the build tooling found while building.
- why-this-problem-exists: verify-manifest used `\b` after the id, so "3.1" matched "3.1.1", and findIndex took the first mention anywhere.
- record-consulted: verify-manifest.mjs, lib.mjs, CLAUDE.md headings (### 3.1 at 339, ## 0. at 10, §1.5 as item 5 at 69).
- conflicts-with-framework: NONE.
- ambiguities: NONE. The note stays advisory (F5); only its pointer and the exact match change.

## FOUR-LAYER
1. build-structure: two small pure helpers in the shared lib.
2. operational-effect: the notes are now true, and the re-pointed manifest has none.
3. synergetic-comp: the hard check (the id must be in the file) is unchanged.
4. surface: n/a.

## Session-read manifest

```json
[
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-197",
    "read_at": "2026-11-27T02:44:00Z",
    "why_it_governs": "Fail loud: a claim table that can't be written stops sends with a 500.",
    "how_this_build_will_embody_it": "claimErrors → 500."
  },
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-45",
    "read_at": "2026-11-27T02:44:00Z",
    "why_it_governs": "Understand first: every commit today showed 'stale line_range' notes pointing at the wrong lines — the gate took a section's first mention (and matched 3.1 inside 3.1.1), not its heading.",
    "how_this_build_will_embody_it": "idHomeLine prefers the heading and matches ids exactly; the newest manifest re-pointed from it."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-45",
    "read_at": "2026-11-27T02:44:00Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "Read at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-27T02:44:00Z",
    "why_it_governs": "Holistic: the runner reuses listProspects (pinned), dealRisk, runAgent; drivers past and present share one rule.",
    "how_this_build_will_embody_it": "driversOf behind dealDrivers and driversFromSnapshots."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-118",
    "read_at": "2026-11-27T02:44:00Z",
    "why_it_governs": "Layer 4 / 2: an irreversible action (revoke) gets a confirm.",
    "how_this_build_will_embody_it": "Two-step revoke."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-173",
    "read_at": "2026-11-27T02:44:00Z",
    "why_it_governs": "Proactive review of today's changes; a test also caught a swapped-argument bug in the rewrite before commit.",
    "how_this_build_will_embody_it": "Test-first on the rewritten scan."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-334",
    "read_at": "2026-11-27T02:44:00Z",
    "why_it_governs": "One matcher: which wordings are 'the same topic' is market.ts topicKey; SQL never re-derives it.",
    "how_this_build_will_embody_it": "The route computes the members with topicKey; the SQL only blanks the ones it is given."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-346",
    "read_at": "2026-11-27T02:44:00Z",
    "why_it_governs": "Events are immutable, so a junk event is permanent noise in the deal's history.",
    "how_this_build_will_embody_it": "Saving an email no longer writes a deal event."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-27T02:44:00Z",
    "why_it_governs": "Agents act once per close date; the editor says it's checked each night.",
    "how_this_build_will_embody_it": "Editor copy."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-362",
    "read_at": "2026-11-27T02:44:00Z",
    "why_it_governs": "Legal erasure must reach every stored copy, including a retired group version the company can still read.",
    "how_this_build_will_embody_it": "Retirements are no longer filtered out."
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "363-367",
    "read_at": "2026-11-27T02:44:00Z",
    "why_it_governs": "Nothing half-understood: a day with no record says so, never 'no warnings'.",
    "how_this_build_will_embody_it": "recorded: false → 'Nothing was recorded on …'."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-473",
    "read_at": "2026-11-27T02:44:00Z",
    "why_it_governs": "The checklist before acting.",
    "how_this_build_will_embody_it": "Run in this record."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-479",
    "read_at": "2026-11-27T02:44:00Z",
    "why_it_governs": "The methodology document must be read from the working tree this session, not recalled from cached labels.",
    "how_this_build_will_embody_it": "The teardown, evidence and migrations named in UNDERSTANDING were opened this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-634",
    "read_at": "2026-11-27T02:44:00Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-792",
    "read_at": "2026-11-27T02:44:00Z",
    "why_it_governs": "Views need security_invoker, or they read past RLS.",
    "how_this_build_will_embody_it": "accounts_current and contacts_current are security_invoker."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-819",
    "read_at": "2026-11-27T02:44:00Z",
    "why_it_governs": "Schema-complete isn't built: agents need a writer, a trigger point and a surface.",
    "how_this_build_will_embody_it": "Engage → Agents writes them; a stage change on a deal runs them; runs are listed."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1025",
    "read_at": "2026-11-27T02:44:00Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
