---
started_at: 2026-11-26T21:38:00Z
trigger: Engage plan Phase E4 (docs/ELOSTATE-ENGAGE-PLATFORM-BUILD-PLAN/docs/07-BUILD-ORDER.md): the MCP server, right after E3 shipped (602cdcc2).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Engage E4: the MCP server

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: POST /api/mcp (initialize, ping, tools/list, tools/call), tools list_deals, get_deal, get_account and ask_deal; company keys with the MCP scope (E3); the invariant audit learns authenticateApiKey as a gate.
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: Gong M32 F32.1–F32.4 lets Claude, ChatGPT and Copilot query the sales data through MCP.
- why-this-problem-exists: E3 opened a REST read path, but AI assistants speak MCP, and the deal-level questions (ask_deal, a brief) need our AI reads.
- record-consulted: E3's publicApi and publicApiRead, dealCalls.ts, playbook.callsBlock, hidePhrases, claude.ts (the call() wrapper), the teardown's M32.
- conflicts-with-framework: NONE.
- ambiguities: E8 (revised in E3): company keys; per-person access needs a JWT secret.

## FOUR-LAYER
1. build-structure: a thin JSON-RPC route over pure tool functions; reads pinned to the company.
2. operational-effect: an assistant connects with a key, lists deals, reads one, and asks about it with references to call lines.
3. synergetic-comp: the same keys and usage report as the API; the brief it returns is the deal panel's.
4. surface: the API keys panel names the MCP address.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T21:42:00Z",
    "why_it_governs": "Understanding first: Gong's MCP server (M32 F32.1) offers ask_account, ask_deal and generate_brief to outside AI clients; read from the teardown, and the MCP protocol shape (initialize, tools/list, tools/call).",
    "how_this_build_will_embody_it": "Four read-only tools over the same company-pinned reads as the API."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T21:42:00Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "Read at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T21:42:00Z",
    "why_it_governs": "Holistic: data leaving the system must respect hidden calls, erasure and the tenant boundary at once.",
    "how_this_build_will_embody_it": "Every statement pins the company; hidden calls are left out; erased data is already gone from the source tables."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "92-150",
    "read_at": "2026-11-26T21:42:00Z",
    "why_it_governs": "Four layers, foundation up.",
    "how_this_build_will_embody_it": "FOUR-LAYER block above."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "152-180",
    "read_at": "2026-11-26T21:42:00Z",
    "why_it_governs": "Audit the neighbours while building.",
    "how_this_build_will_embody_it": "check.md covers erasure, RLS and the tree."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "260-280",
    "read_at": "2026-11-26T21:42:00Z",
    "why_it_governs": "One authority each: the key check (authenticateApiKey), hidden calls (hiddenInCompanyFrom), a deal's calls (loadDealCalls).",
    "how_this_build_will_embody_it": "The MCP route consumes all three; no second key or hide logic."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "290-300",
    "read_at": "2026-11-26T21:42:00Z",
    "why_it_governs": "Events are immutable: keys are never edited (revoked once); usage is appended.",
    "how_this_build_will_embody_it": "Guard trigger and append-only rules."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "302-316",
    "read_at": "2026-11-26T21:42:00Z",
    "why_it_governs": "Erasure is the only exception and has a single door.",
    "how_this_build_will_embody_it": "Contacts and accounts are erased through rss_erase_sessions and rss_erase_prospects, shown and confirmed first."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "324-340",
    "read_at": "2026-11-26T21:42:00Z",
    "why_it_governs": "Guide, don't overtake: the MCP tools only read; an outside AI can't change anything in EloState.",
    "how_this_build_will_embody_it": "No tool writes."
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "318-322",
    "read_at": "2026-11-26T21:42:00Z",
    "why_it_governs": "Nothing half-understood reaches a person: an answer's references must point at real lines; a deal outside the company is 'not found'.",
    "how_this_build_will_embody_it": "resolveCallRefs keeps only real lines; tool errors are readable text."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "420-470",
    "read_at": "2026-11-26T21:42:00Z",
    "why_it_governs": "The checklist before acting.",
    "how_this_build_will_embody_it": "Run in this record."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-459",
    "read_at": "2026-11-26T21:42:00Z",
    "why_it_governs": "The methodology document must be read from the working tree this session, not recalled from cached labels.",
    "how_this_build_will_embody_it": "The teardown, evidence and migrations named in UNDERSTANDING were opened this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T21:42:00Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T21:42:00Z",
    "why_it_governs": "Views need security_invoker, or they read past RLS.",
    "how_this_build_will_embody_it": "accounts_current and contacts_current are security_invoker."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-800",
    "read_at": "2026-11-26T21:42:00Z",
    "why_it_governs": "Schema-complete isn't built: keys need a surface to make and revoke them, and usage needs to be read.",
    "how_this_build_will_embody_it": "Protection → API keys, with 24-hour use per key."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T21:42:00Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
