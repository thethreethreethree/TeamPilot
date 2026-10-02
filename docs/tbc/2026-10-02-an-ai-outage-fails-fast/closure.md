# CLOSURE - an AI outage fails fast

## What is true now

When DeepSeek stops answering, a server instance stops calling it after two failures and answers in no time for
the next minute, then tries once more. A pitch hit by the outage waits five minutes and keeps its attempts, for up
to a day after it was recorded.

## Residual

```json
[
  {
    "id": "R1-breaker-per-instance",
    "item": "Each fresh server instance pays up to two 45 s timeouts before it learns of an outage.",
    "why_skipped": "A shared record would need a migration; the per-instance version needs none and covers the cron and busy instances.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-10-02T04:20:00Z",
    "outcome": "OPEN."
  },
  {
    "id": "R2-not-seen-in-an-outage",
    "item": "The breaker and the deferral have not been observed during a real outage; DeepSeek recovered before this shipped.",
    "why_skipped": "Needs an outage. The logs will show '[llm] deepseek not answering' and '[doorlog/worker] AI provider not answering' lines.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-10-02T04:20:00Z",
    "outcome": "OPEN."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
