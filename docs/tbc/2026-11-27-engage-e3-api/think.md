---
started_at: 2026-11-26T21:33:00Z
trigger: Engage plan Phase E3 (docs/ELOSTATE-ENGAGE-PLATFORM-BUILD-PLAN/docs/07-BUILD-ORDER.md): the public read API, right after E2 shipped (7fc22de3).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Engage E3: the public read API

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: api_keys, api_usage (0378); /api/v1/deals, accounts, contacts, calls; key creation, revocation and usage on Protection.
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: Gong M31: a REST API for calls, users and stats (F31.1–F31.3), rate limits (F31.6), usage (F31.9).
- why-this-problem-exists: nothing outside EloState could read its deals, accounts, contacts or calls; the only outbound path was a webhook per call.
- record-consulted: callerScopedDb (bearer handling), rateLimit (keys by address), hidePhrases (hiddenInCompanyFrom), recordAudit, the teardown's M31; .env.local has no JWT secret.
- conflicts-with-framework: NONE.
- ambiguities: E7 (key model) and E8 (MCP access). Company keys made by an admin; per-person access waits on a JWT secret (plan 00 updated).

## FOUR-LAYER
1. build-structure: one key check, one read handler, company pinned in every statement.
2. operational-effect: an admin makes a key, shown once; a tool reads /api/v1/... with it; limits answer 429.
3. synergetic-comp: on Protection, beside webhooks and erasure; revoking is immediate.
4. surface: one panel with 24-hour use per key.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T21:37:00Z",
    "why_it_governs": "Understanding first: Gong's public API (M31) is company keys, read endpoints, limits and a usage report; read from the teardown; and what this server can do: no JWT secret, so a key can't act as one person.",
    "how_this_build_will_embody_it": "Company keys, read-only, company-pinned; per-person access recorded as a precondition."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T21:37:00Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "Read at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T21:37:00Z",
    "why_it_governs": "Holistic: data leaving the system must respect hidden calls, erasure and the tenant boundary at once.",
    "how_this_build_will_embody_it": "Every statement pins the company; hidden calls are left out; erased data is already gone from the source tables."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "92-150",
    "read_at": "2026-11-26T21:37:00Z",
    "why_it_governs": "Four layers, foundation up.",
    "how_this_build_will_embody_it": "FOUR-LAYER block above."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "152-180",
    "read_at": "2026-11-26T21:37:00Z",
    "why_it_governs": "Audit the neighbours while building.",
    "how_this_build_will_embody_it": "check.md covers erasure, RLS and the tree."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "260-280",
    "read_at": "2026-11-26T21:37:00Z",
    "why_it_governs": "One authority for hidden calls: rss_hidden_calls_for via hiddenInCompanyFrom; one for a key: its hash lookup.",
    "how_this_build_will_embody_it": "The calls endpoint consumes hiddenInCompanyFrom; authenticateApiKey is the only key check."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "290-300",
    "read_at": "2026-11-26T21:37:00Z",
    "why_it_governs": "Events are immutable: keys are never edited (revoked once); usage is appended.",
    "how_this_build_will_embody_it": "Guard trigger and append-only rules."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "302-316",
    "read_at": "2026-11-26T21:37:00Z",
    "why_it_governs": "Erasure is the only exception and has a single door.",
    "how_this_build_will_embody_it": "Contacts and accounts are erased through rss_erase_sessions and rss_erase_prospects, shown and confirmed first."
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "318-322",
    "read_at": "2026-11-26T21:37:00Z",
    "why_it_governs": "Nothing half-understood leaves: no transcripts through the API; a failed read is a 500, never an empty page.",
    "how_this_build_will_embody_it": "Metadata only; each endpoint returns 500 on error."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "420-470",
    "read_at": "2026-11-26T21:37:00Z",
    "why_it_governs": "The checklist before acting.",
    "how_this_build_will_embody_it": "Run in this record."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-459",
    "read_at": "2026-11-26T21:37:00Z",
    "why_it_governs": "The methodology document must be read from the working tree this session, not recalled from cached labels.",
    "how_this_build_will_embody_it": "The teardown, evidence and migrations named in UNDERSTANDING were opened this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T21:37:00Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T21:37:00Z",
    "why_it_governs": "Views need security_invoker, or they read past RLS.",
    "how_this_build_will_embody_it": "accounts_current and contacts_current are security_invoker."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-800",
    "read_at": "2026-11-26T21:37:00Z",
    "why_it_governs": "Schema-complete isn't built: keys need a surface to make and revoke them, and usage needs to be read.",
    "how_this_build_will_embody_it": "Protection → API keys, with 24-hour use per key."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T21:37:00Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
