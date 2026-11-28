# CLOSURE - once per link

## What is true now

A call-added agent runs once per call on a deal — when the call is linked, or when its transcript lands if it was
linked first — and never again on a trim, relabel or reprocess.

## Residual

```json
[
  {"id": "R1-no-reread", "item": "A corrected transcript doesn't re-read the playbook on its own.", "why_skipped": "Re-running the agent would repeat its notifications and to-dos; the Playbook tab's button reads again on request.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-28T05:12:00Z", "outcome": "Recorded."},
  {"id": "R2-inline-ai", "item": "When a call-added agent with a playbook action fires on processing, its AI read runs inline in that processing (e.g. /finalize), adding its time to the request.", "why_skipped": "Only the first time per call and only for companies that saved such an agent (others pay one agents read); moving it to a background job is a follow-up if it shows in timings.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-28T05:12:00Z", "outcome": "Recorded."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
