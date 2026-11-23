# CLOSURE - Ask Coach across the pipeline

## What is true now

On Remote Sales → Pipeline a rep can ask one question about their whole pipeline ("which deals are at risk?", "which
prospects have no next call booked?"), and a manager can ask about one report's pipeline or the team's. The coach reads
each prospect's stage, amount, next and last call, open to-dos and its latest call's key points and agreed next steps,
and answers naming the prospects; each name opens that prospect. Only prospects the asker is allowed to see are read. If
any read fails, the asker sees an error and no AI call is made. When coaching answers are switched off, it says so.

## Residual

```json
[
  {"id": "R1-no-transcripts", "item": "The pipeline answer reads call summaries (briefs), not transcripts; a call without a brief contributes only its pipeline facts.", "why_skipped": "Transcripts for a whole pipeline would be slow and costly; Ask Coach over chosen calls already reads transcripts.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-23T00:20:00Z", "outcome": "Stated on screen under every answer."},
  {"id": "R2-cap-60", "item": "Pipelines larger than 60 prospects are read as the 60 most recently active.", "why_skipped": "Bounds prompt size and cost.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-23T00:20:00Z", "outcome": "Stated on screen when it applies."},
  {"id": "R3-no-history", "item": "Pipeline questions are not saved as a chat (Ask Coach over calls is); asking again starts fresh.", "why_skipped": "One-shot first; saved threads are their own build.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-23T00:20:00Z", "outcome": "Opened: OPEN.md."},
  {"id": "R4-ui-test", "item": "No component test renders the Ask box (citation buttons, reset on switching pipelines).", "why_skipped": "The remote-sales screens have no component-test harness yet.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-23T00:20:00Z", "outcome": "Opened: OPEN.md."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
