# CLOSURE - Engage E5: agents

## What is true now

Managers build agents on Engage → Agents. When a deal reaches a stage (by name, by status, or both), an agent does what
it was set up to do, in order: write the deal brief, notify the deal's rep or the manager, add a to-do with a due date
on the deal, send an agent.ran webhook. It acts only on deals its owner can see, and reads only the calls its owner may
hear. Each run lists what every action did. A test on a chosen deal says what would happen and changes nothing. Agents
can be turned off or retired, never edited.

## Residual

```json
[
  {"id": "R1-date-triggers", "item": "No date triggers (a close date approaching) and no tracker-heard trigger yet.", "why_skipped": "Date triggers need a scheduled job and CRON_SECRET is unset (§1.5.3); a tracker trigger needs a hook where tracker hits are written.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-26T21:46:00Z", "outcome": "Recorded."},
  {"id": "R2-agent-ai-actions", "item": "No 'generate with AI' action with a free prompt (F27.4).", "why_skipped": "A free prompt over customer data needs its own guardrails and cost cap; the brief action covers the common case.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-26T21:46:00Z", "outcome": "Recorded."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
