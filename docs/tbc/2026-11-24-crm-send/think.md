---
started_at: 2026-11-24T01:02:03Z
trigger: General Sales Interface PDF — Highlights "API integration (SalesForce/whatever platform the company uses)"; founder picker "Company webhook".
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Send a call to the company's CRM

## The record

- Webhooks exist: webhook_endpoints (events allowlist), webhook_deliveries (queue), rss_webhook_enqueue, a signed
  send cron, a delivery log in Protection → Webhooks.
- The Macro Highlights follow-up said CRM sending "comes later; for now, copy it".
- Every CRM (Salesforce, HubSpot, Pipedrive) can take a webhook through its own automation or a connector such as
  Zapier; building one connector per vendor is outside the picker.

## Outside view

A queue that stores the summary would be a second copy of a customer's words outside erasure. Storing only ids and
building the payload at send time keeps one copy.

## Design

0330: event 'call.to_crm' in both event checks; the queue row for it may hold only sessionId and sentBy.
crmExport.buildCrmCall builds the call, brief, latest follow-up drafts and linked prospect, every read pinned to the
company. The send cron expands it at send time. POST /api/coach/remote/[id]/send-to-crm (the caller must be able to
open the call; a sales call; not live) enqueues and audits; 409 with plain words when no endpoint listens.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-24T01:05:55Z",
    "why_it_governs": "Understand before building: the PDF's Highlights asks for 'API integration (SalesForce/whatever platform the company uses)'; the record has company webhooks (endpoints, a queue, a signed send cron) and no CRM connector, and the founder chose 'Company webhook'.",
    "how_this_build_will_embody_it": "Build on the existing webhook path; no per-vendor connector is invented."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-24T01:05:55Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-24T01:05:55Z; the PDF section in EVIDENCE.md was read earlier this session."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-24T01:05:55Z",
    "why_it_governs": "Holistic: the webhook event list is shared by the endpoint settings, the queue's check constraints, the enqueue function and the send cron.",
    "how_this_build_will_embody_it": "0330 widens both event constraints together; WEBHOOK_EVENTS, the settings label and the cron expansion change in the same commit."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-24T01:05:55Z",
    "why_it_governs": "Layer 3, workflow: the rep finishes a call, reads Highlights, drafts the follow-up, and then needs it in the company's CRM without retyping.",
    "how_this_build_will_embody_it": "The button sits under the follow-up drafts and sends the brief, key points, next steps and the latest drafts in one press; with no CRM connected the rep reads who fixes it and where."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-24T01:05:55Z",
    "why_it_governs": "Look past the task: a queued delivery holding call text would put customer content in a second table that erasure (0316/0322/0323) does not cover.",
    "how_this_build_will_embody_it": "The queue holds only ids (a database check refuses anything else); the content is read at send time, so an erased call sends nothing erased."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-24T01:05:55Z",
    "why_it_governs": "The feature depends on config outside the code: a company admin must add a webhook endpoint subscribed to 'call.to_crm', and their CRM must accept it.",
    "how_this_build_will_embody_it": "Fails loud: with no endpoint the rep sees a 409 naming Protection → Webhooks; the admin setup is recorded as a residual, not hidden."
  },
  {
    "id": "§1.5.4",
    "source_file": "CLAUDE.md",
    "line_range": "198-210",
    "read_at": "2026-11-24T01:05:55Z",
    "why_it_governs": "The founder specified the PDF's elements as the result; CRM integration is one of them, so it is layer 2, not optional polish.",
    "how_this_build_will_embody_it": "Shipped as a working send, not as the 'comes later' line it replaces."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-24T01:05:55Z",
    "why_it_governs": "Who may send a call is decided once: getSession under the caller's own client and isSalesCall.",
    "how_this_build_will_embody_it": "The route branches on those verdicts; the cron re-reads by the stored session id, pinned to the delivery's company."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-24T01:05:55Z",
    "why_it_governs": "Deliveries and audits are append-only records.",
    "how_this_build_will_embody_it": "Each send appends a delivery per endpoint and a session.export audit; nothing is updated in place."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-24T01:05:55Z",
    "why_it_governs": "Legal erasure must keep covering every stored copy of a customer's words.",
    "how_this_build_will_embody_it": "No new stored copy: the queue holds ids only (constraint webhook_deliveries_crm_ids_only); content is built at send time from the erasure-covered tables."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-24T01:05:55Z",
    "why_it_governs": "Guide, don't overtake: the founder chose how CRM sending works.",
    "how_this_build_will_embody_it": "Picker 'Company webhook'; the rep decides when to send each call."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-24T01:05:55Z",
    "why_it_governs": "Honesty: the button must not claim the CRM received the call when only the queue did.",
    "how_this_build_will_embody_it": "The confirmation says it goes to the company's connection within a few minutes; failed deliveries stay visible in the existing webhook log."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-24T01:05:55Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "The CRM approach was a picker; no prose choice offered."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-24T01:05:55Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-24T01:05:55Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-24T01:05:55Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "The ids-only rule is a database check, replayed locally (a content payload is refused), not a code comment."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-24T01:05:55Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
