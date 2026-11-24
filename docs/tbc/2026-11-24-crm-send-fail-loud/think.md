---
started_at: 2026-11-24T20:44:49Z
trigger: Ledger stale-note sweep (F6.3, F5.7) → the CRM send's external precondition (RSS_WEBHOOK_SIGNING_SECRET, OPEN.md:176, still open).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Send to CRM fails loud without webhook signing

## The record

- send-cron: 503 "RSS_WEBHOOK_SIGNING_SECRET not set — webhooks are queued but not sent."
- send-to-crm (ace7b9f5): queued and answered {queued: N}; the UI said "Sent to your CRM".
- /api/health (production, 2026-11-24T20:43Z): no webhook flag; anthropic false, deepseek active, email false.
- I cannot read Vercel's env from here; OPEN.md:176 is unchecked.

## Outside view

From the rep's seat a queue that never drains is a lie told by the button.

## Design

webhooksConfigured() (one verdict). Send to CRM refuses with 503 and plain words when false; health reports it.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-24T20:44:50Z",
    "why_it_governs": "Found while correcting stale ledger notes: OPEN.md still lists RSS_WEBHOOK_SIGNING_SECRET as unset in Vercel; the send cron refuses without it (503 in its own log), yet 'Send to CRM' answered 'Sent to your CRM'.",
    "how_this_build_will_embody_it": "The rep's route asks the same verdict the cron does before queuing."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-24T20:44:50Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-24T20:44:50Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-24T20:44:50Z",
    "why_it_governs": "Holistic: four places decided 'can webhooks be sent' by reading the env var themselves.",
    "how_this_build_will_embody_it": "webhooksConfigured() in webhooks.ts; the panel, the cron, Send to CRM and /api/health call it."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-24T20:44:50Z",
    "why_it_governs": "Layer 2: a rep pressing Send to CRM must be told the truth about whether it left.",
    "how_this_build_will_embody_it": "Refused with 'isn't switched on for ELOSTATE yet … Nothing was sent; copy the follow-up for now'."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-24T20:44:50Z",
    "why_it_governs": "Look past the task: the ledger's notes on uploads, webhooks and CRM were stale after this week's builds.",
    "how_this_build_will_embody_it": "Six notes corrected (F5.2, F5.7, F6.3, F20.8, F27.3, F27.11); no grade changed."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-24T20:44:50Z",
    "why_it_governs": "A feature depending on external config is not complete until the config is verified or the dependency fails loud to a human.",
    "how_this_build_will_embody_it": "The dependency now fails loud to the rep, and /api/health reports webhooks: true/false so the founder can check it with one request."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-24T20:44:50Z",
    "why_it_governs": "One verdict for one decision.",
    "how_this_build_will_embody_it": "webhooksConfigured() is the only reader of the env var besides endpointSecret's default."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-24T20:44:50Z",
    "why_it_governs": "Honesty: never claim a send that can't happen.",
    "how_this_build_will_embody_it": "Nothing is queued when it can't be signed."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-24T20:44:50Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "None needed; the setup step stays the founder's (OPEN.md)."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-24T20:44:50Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-24T20:44:50Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-24T20:44:50Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "send-to-crm test pins the 503 and that nothing is queued."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-24T20:44:50Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code, including the production health read."
  }
]
```
