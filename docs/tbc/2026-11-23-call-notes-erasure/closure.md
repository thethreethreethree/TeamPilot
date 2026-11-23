# CLOSURE - Call notes, and erasure that reaches every copy of a customer's words

## What is true now

Reps can take notes on their phone and video calls — while the call is live (each note is stamped with the moment and
plays from there) or afterwards. Their managers can read them, as the box says. Notes are never edited or deleted; long
numbers are removed as in transcripts.

Building it showed that erasing a customer did not reach everything: call summaries, follow-up drafts, checklist items,
the prospect's name and company, a rep's feedback-request message and notification text could still hold the
customer's words. Erasure now removes all of these as well as the new notes, and keeps the non-personal facts (the
call, the rep, scores, the deal's amount and stage). It is applied to the live database. A test now fails if a future
table holding a call's words is not covered.

## Residual

```json
[
  {"id": "R1-scenarios", "item": "Practice scenarios built from a call may describe the customer and are not touched by erasure (F2).", "why_skipped": "Manager-written training material, immutable by design; whether to retire them is the founder's decision.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-23T10:35:00Z", "outcome": "Opened: OPEN.md (founder decision)."},
  {"id": "R2-day-plans", "item": "A rep's daily brain dump (remote_day_plans) may name a customer but isn't tied to a call, so erasure can't find it.", "why_skipped": "No call key to match on.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-23T10:35:00Z", "outcome": "Opened: OPEN.md."},
  {"id": "R3-ui-test", "item": "No component test renders the notes box.", "why_skipped": "No harness for these screens.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-23T10:35:00Z", "outcome": "Covered by the existing OPEN.md component-test entry."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
