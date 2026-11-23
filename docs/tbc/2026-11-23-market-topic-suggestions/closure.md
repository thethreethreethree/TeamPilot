# CLOSURE - AI-suggested topic groups, approved by a manager

## What is true now

Managers see a "Topic groups" panel on Market (Remote Sales → Market, and Sales Coach → Analytics). "Suggest groups"
asks the AI which of the company's topics (those raised on two or more calls, not already grouped) mean the same thing.
Each suggestion can be renamed and have topics unticked, then accepted or skipped; nothing changes until a manager
accepts. An accepted group is counted as one topic under its name, once per call, with every wording it gathered
listed; "Ungroup" undoes it. Groups are kept as history (an edit or ungroup adds a row). Reps see the grouped names in
Topics but not the panel. Migration 0319 is applied to production. No manager has run a suggestion against real
topics yet, so the quality of the AI's groups has not been seen.

## Residual

```json
[
  {"id": "R1-first-run", "item": "The first real 'Suggest groups' run has not been seen; whether the AI's groups are sensible on real topics is unproven.", "why_skipped": "It runs when a manager clicks it in the product; running it from here would send company topics outside the product's own path.", "confidence_it_does_not_matter": "low", "opened_at": "2026-11-23T20:40:00Z", "outcome": "Opened: OPEN.md, as a founder check."},
  {"id": "R2-erasure", "item": "Legal erasure does not reach topic-group members (they are company topics, not tied to a call).", "why_skipped": "Members are limited to topics raised on two or more calls, which are topics rather than one customer's words; extending erasure to labels needs a rule for matching them.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-23T20:40:00Z", "outcome": "Opened: OPEN.md."},
  {"id": "R3-manual", "item": "A manager can edit an AI suggestion but cannot build a group from scratch.", "why_skipped": "The founder chose AI-suggests-manager-OKs; a from-scratch builder is extra.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-23T20:40:00Z", "outcome": "Opened: OPEN.md."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
