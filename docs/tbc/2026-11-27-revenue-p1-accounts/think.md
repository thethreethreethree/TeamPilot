---
started_at: 2026-11-26T20:20:00Z
trigger: Founder 2026-11-27 — "I WANT YOU TO BUILD A SYSTEM COMPETITIVE TO GONG"; picker "Deals + accounts first"; plan docs/ELOSTATE-REVENUE-BUILD-PLAN (Phase 1).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Revenue Phase 1: accounts and contacts

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: accounts and contacts under the existing prospects (deals); a one-time backfill from each prospect's organisation; deal contacts; call contacts; erasure reaching all of it; the Accounts list and account page; account and contacts on the deal panel; "Who was this?" on the call.
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: build the revenue stack Gong sells (teardown M20/M21/M22/M29). Start with deals and accounts. This phase is the account and contact layer every later phase hangs on.
- why-this-problem-exists: the remote-sales plan matched Gong on coaching only. Its Tech 6 set the revenue stack aside ("a separate decision"). Today a prospect has a free-text `organization` (0303), so two deals at the same company are unrelated, there are no contacts, and the call's customer is just a name typed on that one call (0343). No warning, playbook or forecast can be built on that.
- record-consulted: `gong-teardown.json` M20, M21, M22, M29; the evidence report (#1011 #12 #1555 #1567 #1000); migrations 0303, 0304, 0313, 0320, 0323, 0325, 0343, 0365, 0369; the erasure route; `invariant-audit.mjs` ERASURE_EXTENSIONS.
- conflicts-with-framework: NONE.
- ambiguities: R1–R12 in the plan's 00, each with a stand-in. None blocks this phase.

## FOUR-LAYER
1. build-structure: the deal stays the prospect (R1), so there's one pipeline. Accounts and contacts are append-only, with current state as invoker views. Find-or-create sits behind a lock and a key computed in SQL, so there's one authority (§2.2).
2. operational-effect: the backfill makes accounts out of the existing pipeline, so the Accounts page isn't empty on day one. A rep picks or creates an account on a deal, and adds contacts with roles. On a call, "Who was this?" links the customer to a contact.
3. synergetic-comp: before, the rep works a deal in Pipeline or reviews a call. After, the account page shows every deal, call and contact together, and each item links back to Pipeline or the call. Erasure keeps one door.
4. surface: the app's semantic tokens, and the same "Mine / Team / rep" scope as Pipeline.

## Session-read manifest

```json
[
  {"id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-11-26T20:29:25Z", "why_it_governs": "Understanding first: the gap is the revenue stack, read from the teardown and evidence before any code.", "how_this_build_will_embody_it": "UNDERSTANDING block above, from the record."},
  {"id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-30", "read_at": "2026-11-26T20:29:25Z", "why_it_governs": "The methodology must be in the tree and read this session.", "how_this_build_will_embody_it": "Read at read_at, after started_at."},
  {"id": "§1.5", "source_file": "CLAUDE.md", "line_range": "78-90", "read_at": "2026-11-26T20:29:25Z", "why_it_governs": "Holistic: accounts touch prospects, calls, erasure and the AI reads.", "how_this_build_will_embody_it": "The deal stays the prospect; erasure extended in the same function."},
  {"id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "92-150", "read_at": "2026-11-26T20:29:25Z", "why_it_governs": "Four layers, foundation up.", "how_this_build_will_embody_it": "FOUR-LAYER block above."},
  {"id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "152-180", "read_at": "2026-11-26T20:29:25Z", "why_it_governs": "Audit the neighbours while building.", "how_this_build_will_embody_it": "check.md covers erasure, RLS and the tree."},
  {"id": "§2.2", "source_file": "CLAUDE.md", "line_range": "260-280", "read_at": "2026-11-26T20:29:25Z", "why_it_governs": "One authority for a decision.", "how_this_build_will_embody_it": "The account key and find-or-create live only in SQL; the route consumes the id."},
  {"id": "§3.1", "source_file": "CLAUDE.md", "line_range": "290-300", "read_at": "2026-11-26T20:29:25Z", "why_it_governs": "Events are immutable: an account name, a contact title, a deal role and a call link are each appended, never edited, so the history the later warnings and win/loss read stays whole.", "how_this_build_will_embody_it": "Names, titles, accounts and roles are events; current state is a view."},
  {"id": "§3.1.1", "source_file": "CLAUDE.md", "line_range": "302-316", "read_at": "2026-11-26T20:29:25Z", "why_it_governs": "Erasure is the only exception and has a single door.", "how_this_build_will_embody_it": "Contacts and accounts are erased through rss_erase_sessions and rss_erase_prospects, shown and confirmed first."},
  {"id": "§3.2", "source_file": "CLAUDE.md", "line_range": "318-322", "read_at": "2026-11-26T20:29:25Z", "why_it_governs": "Nothing half-understood reaches a person.", "how_this_build_will_embody_it": "Activity level is absent until Phase 4 computes it; it isn't shown empty."},
  {"id": "§6", "source_file": "CLAUDE.md", "line_range": "420-470", "read_at": "2026-11-26T20:29:25Z", "why_it_governs": "The checklist before acting.", "how_this_build_will_embody_it": "Run in this record."},
  {"id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-459", "read_at": "2026-11-26T20:29:25Z", "why_it_governs": "The methodology document must be read from the working tree this session, not recalled from cached labels.", "how_this_build_will_embody_it": "The teardown, evidence and migrations named in UNDERSTANDING were opened this session."},
  {"id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-598", "read_at": "2026-11-26T20:29:25Z", "why_it_governs": "No citation without a session read.", "how_this_build_will_embody_it": "Every row was read at read_at."},
  {"id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-774", "read_at": "2026-11-26T20:29:25Z", "why_it_governs": "Views need security_invoker, or they read past RLS.", "how_this_build_will_embody_it": "accounts_current and contacts_current are security_invoker."},
  {"id": "A31", "source_file": "ThinkerThinker.md", "line_range": "793-800", "read_at": "2026-11-26T20:29:25Z", "why_it_governs": "Schema-complete isn't built: every table needs a writer and a surface.", "how_this_build_will_embody_it": "Each new table has a route that writes it and a screen that reads it."},
  {"id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1005", "read_at": "2026-11-26T20:29:25Z", "why_it_governs": "Verified is a claim about a command that was run.", "how_this_build_will_embody_it": "check.md names each command with its result."}
]
```
