# CLOSURE - Editable transcripts

## What is true now

On any call page, the rep on the call and the managers above them can correct a line of the transcript: a pencil on
the line opens it, and "Save correction" stores the corrected words. Nothing is overwritten — the call gets a new
transcript version and the original words stay on record. Every corrected line shows an "edited" mark; clicking it
shows what it said before, who corrected it and when. Keyword hits and talk stats follow the corrected words at once;
the page says the summary and review were written from the earlier words and can be regenerated. Each correction is in
the audit log. Not possible while a call is live, or on a line removed by a trim. The database change is applied.

## Residual

```json
[
  {"id": "R1-ai-notes", "item": "Corrections do not redo the AI summary, review and follow-through (F1).", "why_skipped": "Five paid AI calls per edit; the page offers regenerate.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-23T07:00:00Z", "outcome": "Opened: OPEN.md."},
  {"id": "R2-timing", "item": "A corrected line keeps the original line's times (F2).", "why_skipped": "Re-timing needs the audio aligned again.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-23T07:00:00Z", "outcome": "Opened: OPEN.md."},
  {"id": "R3-speaker", "item": "Only the words can be corrected, not who spoke (the existing relabel covers whole voices).", "why_skipped": "Per-line speaker change is a separate edit kind.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-23T07:00:00Z", "outcome": "Opened: OPEN.md."},
  {"id": "R4-ui-test", "item": "No component test renders the pencil, the editor or the edited mark.", "why_skipped": "No component harness for these screens yet.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-23T07:00:00Z", "outcome": "Covered by the existing OPEN.md component-test entry."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
