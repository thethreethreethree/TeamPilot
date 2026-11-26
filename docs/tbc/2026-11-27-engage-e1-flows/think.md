---
started_at: 2026-11-26T21:36:00Z
trigger: Engage plan Phase E1 (docs/ELOSTATE-ENGAGE-PLATFORM-BUILD-PLAN), founder order "Engage next", right after revenue Phase 6 shipped (b527c7c4).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Engage E1: flows, enrolments, today's steps

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: engage_flows, engage_enrolments, engage_activities (0377); contacts gain email and phone; Engage → Today and Flows; "Add to a flow" on the deal panel; erasure.
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: Gong Engage, the sequencer (M24), call outcomes (M25 F25.7–F25.9) and to-dos (F26.3), in our own wording, built to compete.
- why-this-problem-exists: there was no outbound at all: no sequence of steps across deals, no daily list of who to email or call, no call outcomes. Contacts (Phase 1) had no email or phone to reach them with.
- record-consulted: the teardown's M24, M25, M26; emailConfigured() and outbound.ts (Postmark, unset in production); 0370's contacts and erasure; the playbook's replay pattern.
- conflicts-with-framework: NONE.
- ambiguities: E1 (email sending), E2 (rulesets), E3 (outcomes), E4 (dialer). The stand-ins are in the plan's 00: manual email, fixed rules, Gong's default outcomes, tel:.

## FOUR-LAYER
1. build-structure: three append-only tables; the replay is the one state rule; flows never change.
2. operational-effect: a rep adds a contact to a flow from the deal; Today lists due steps; email opens in their mail app; calls dial from the phone and log an outcome.
3. synergetic-comp: a booked meeting or a reply ends the flow; an opt-out blocks every future flow for that person; deal links open the deal.
4. surface: a to-do list in the app's tokens; overdue steps marked.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T21:48:00Z",
    "why_it_governs": "Understanding first: Gong Engage (M24 flows, M25 outcomes, F26.3 to-dos), read from the teardown; and what this repo can send: emailConfigured() is false in production, there is no dialer.",
    "how_this_build_will_embody_it": "Flows run with manual email and phone calls; nothing is sent from the app."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T21:48:00Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "Read at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T21:48:00Z",
    "why_it_governs": "Holistic: contacts gain email and phone, which erasure, the contact search and the deal panel must all reach.",
    "how_this_build_will_embody_it": "0377 extends contacts_current, the match function and all three erasure functions."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "92-150",
    "read_at": "2026-11-26T21:48:00Z",
    "why_it_governs": "Four layers, foundation up.",
    "how_this_build_will_embody_it": "FOUR-LAYER block above."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "182-205",
    "read_at": "2026-11-26T21:48:00Z",
    "why_it_governs": "External-config completeness: automatic email needs Postmark (unset in production) and a dialer needs Twilio; neither may be depended on silently.",
    "how_this_build_will_embody_it": "Email steps open the rep's own mail app; call steps use tel:; the plan's 00 and 08 name the preconditions."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "152-180",
    "read_at": "2026-11-26T21:48:00Z",
    "why_it_governs": "Audit the neighbours while building.",
    "how_this_build_will_embody_it": "check.md covers erasure, RLS and the tree."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "260-280",
    "read_at": "2026-11-26T21:48:00Z",
    "why_it_governs": "One authority for an enrolment's state: the replay of its activities; one check for whether email can be sent: emailConfigured().",
    "how_this_build_will_embody_it": "replayEnrolment is used by Today and by the route; the plan defers automatic email to that check."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "290-300",
    "read_at": "2026-11-26T21:48:00Z",
    "why_it_governs": "Events are immutable: flows are never edited (retired once); enrolment state is the replay of appended activities.",
    "how_this_build_will_embody_it": "Guard trigger on flows; no update or delete on enrolments or activities."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "324-340",
    "read_at": "2026-11-26T21:48:00Z",
    "why_it_governs": "Guide, don't overtake: the app drafts; the rep sends from their own mail app and decides each step.",
    "how_this_build_will_embody_it": "No email leaves the app; every step is the rep's click."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "302-316",
    "read_at": "2026-11-26T21:48:00Z",
    "why_it_governs": "Erasure must reach every stored copy of the customer's words and details: step notes, the contact's email and phone.",
    "how_this_build_will_embody_it": "All three erasure functions extended; the probe shows 0 notes and 0 email/phone left."
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "318-322",
    "read_at": "2026-11-26T21:48:00Z",
    "why_it_governs": "Nothing half-understood reaches a person: a placeholder with nothing to fill shows as [company], never 'Hi ,'.",
    "how_this_build_will_embody_it": "fillTemplate leaves gaps visible."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "420-470",
    "read_at": "2026-11-26T21:48:00Z",
    "why_it_governs": "The checklist before acting.",
    "how_this_build_will_embody_it": "Run in this record."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-459",
    "read_at": "2026-11-26T21:48:00Z",
    "why_it_governs": "The methodology document must be read from the working tree this session, not recalled from cached labels.",
    "how_this_build_will_embody_it": "The teardown, evidence and migrations named in UNDERSTANDING were opened this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T21:48:00Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T21:48:00Z",
    "why_it_governs": "Views need security_invoker, or they read past RLS.",
    "how_this_build_will_embody_it": "accounts_current and contacts_current are security_invoker."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-800",
    "read_at": "2026-11-26T21:48:00Z",
    "why_it_governs": "Schema-complete isn't built: each table needs a writer and a surface.",
    "how_this_build_will_embody_it": "Flows: the editor; enrolments: Add to a flow; activities: Today."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T21:48:00Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
