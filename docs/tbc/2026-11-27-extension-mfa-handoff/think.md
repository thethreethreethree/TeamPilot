---
started_at: 2026-11-26T23:36:00Z
trigger: OPEN.md 2026-11-23 "the mobile app and Chrome extension have no code step" — the extension half.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - The extension's connect page waits for the sign-in code

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: middleware matcher; the matcher-sync and mfa tests; one sentence on Settings → Sign-in codes.
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: close what can be closed of the "no code step" item.
- why-this-problem-exists: the extension takes its session from /extension/connect (getSession → sales-connect), which the middleware never ran on, so the MFA hold didn't apply there.
- record-consulted: extension-sales/background.js (token handoff, refresh), src/app/extension/connect/page.tsx, middleware.ts, lib/auth/mfa.ts, routeGuard.ts, safeRelativePath, the mfa TBC (F2).
- conflicts-with-framework: NONE.
- ambiguities: [INFERRED] a refreshed Supabase session keeps the level it reached (the session row holds it), so the extension's silent refresh stays past the code; verify once TOTP is on.

## FOUR-LAYER
1. build-structure: one matcher entry.
2. operational-effect: connect → code screen → back to connect with ?ext kept → handoff.
3. synergetic-comp: a signed-out visitor still sees the connect page's own "Sign in".
4. surface: Settings says the extension asks for the code through the web sign-in; the mobile app still can't.

## Session-read manifest

```json
[
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "182-205",
    "read_at": "2026-11-26T23:40:00Z",
    "why_it_governs": "External: TOTP must be on in Supabase to verify end to end (OPEN.md BLOCKING SETUP).",
    "how_this_build_will_embody_it": "Stated in closure; unit-tested here."
  },
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T23:40:00Z",
    "why_it_governs": "Understand first: OPEN.md 2026-11-23 — the extension 'has no code step'. Traced: it never signs in itself; /extension/connect hands it the web session, and that page was outside the middleware matcher, so a session still owing its code could be handed over and every API then refused it.",
    "how_this_build_will_embody_it": "Add /extension/:path* to the matcher: the code screen comes first, then the handoff of a session that has passed it."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T23:40:00Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "Read at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T23:40:00Z",
    "why_it_governs": "Holistic: the matcher also runs routeGuard; it doesn't gate /extension (null), so only the MFA hold applies.",
    "how_this_build_will_embody_it": "Matcher-sync test pins both."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "92-150",
    "read_at": "2026-11-26T23:40:00Z",
    "why_it_governs": "Four layers, foundation up.",
    "how_this_build_will_embody_it": "FOUR-LAYER block above."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "152-180",
    "read_at": "2026-11-26T23:40:00Z",
    "why_it_governs": "Proactive: an independent review of the service-role job before its first run.",
    "how_this_build_will_embody_it": "All six findings fixed before 05:15 UTC."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "260-280",
    "read_at": "2026-11-26T23:40:00Z",
    "why_it_governs": "One authority: the existing mfaVerdict/mfaHold decide; nothing new re-derives them.",
    "how_this_build_will_embody_it": "Only the matcher changes."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "290-300",
    "read_at": "2026-11-26T23:40:00Z",
    "why_it_governs": "Events are immutable: this change writes no data, so no event, record or history is created, altered or lost by it.",
    "how_this_build_will_embody_it": "Only the middleware matcher and one Settings sentence change."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "324-340",
    "read_at": "2026-11-26T23:40:00Z",
    "why_it_governs": "Agents act once per close date; the editor says it's checked each night.",
    "how_this_build_will_embody_it": "Editor copy."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "302-316",
    "read_at": "2026-11-26T23:40:00Z",
    "why_it_governs": "Legal erasure: the handoff carries a session token, never customer words, so nothing new needs to be reachable by erasure.",
    "how_this_build_will_embody_it": "No table, column or stored text added."
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "318-322",
    "read_at": "2026-11-26T23:40:00Z",
    "why_it_governs": "Nothing half-understood: a day with no record says so, never 'no warnings'.",
    "how_this_build_will_embody_it": "recorded: false → 'Nothing was recorded on …'."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "420-470",
    "read_at": "2026-11-26T23:40:00Z",
    "why_it_governs": "The checklist before acting.",
    "how_this_build_will_embody_it": "Run in this record."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-459",
    "read_at": "2026-11-26T23:40:00Z",
    "why_it_governs": "The methodology document must be read from the working tree this session, not recalled from cached labels.",
    "how_this_build_will_embody_it": "The teardown, evidence and migrations named in UNDERSTANDING were opened this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T23:40:00Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T23:40:00Z",
    "why_it_governs": "Views need security_invoker, or they read past RLS.",
    "how_this_build_will_embody_it": "accounts_current and contacts_current are security_invoker."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-800",
    "read_at": "2026-11-26T23:40:00Z",
    "why_it_governs": "Schema-complete isn't built: agents need a writer, a trigger point and a surface.",
    "how_this_build_will_embody_it": "Engage → Agents writes them; a stage change on a deal runs them; runs are listed."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T23:40:00Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
