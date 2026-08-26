# CLOSURE — Coaching materials library (pending item 3)

## What shipped
The third pending optional. On the Training tab, each of a rep's focus skills now has a "Learn" button beside
"Practice" that opens a short coaching guide — an overview, the key moves, what to watch out for, and strong lines to
try — generated from the company's OWN sales methodology. The rep reads the guide, then drills the same skill: learning
alongside the live practice, grounded in the team's playbook, with no manual content management.

## Verification (A38)
`npm run check` → EXIT 0 (see check.md). parseCoachingMaterial unit-locked (5); typecheck clean; the route is
auth+company gated, rate-limited, CONVERSATION_IS_DATA fenced, maxDuration exported.

## The un-named reliance
- **Generation is best-effort; a null guide shows an honest "couldn't load".** So a slow/failed generation never breaks
  the Training tab — the rep can retry, or just practise.

## Residual (A36 — explicit)
```json
[
  {
    "id": "R1",
    "item": "Guides are generated on demand, not stored or curated.",
    "why_skipped": "Consistent with the corpus-grounded no-CMS approach; the team's methodology IS the source of truth, so a guide is always fresh from it. A saved/curated library (manager edits, pinned guides) is an additive slice.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-27T06:12:00+08:00",
    "outcome": "OPENED + bounded: per-skill guides from the team's own method deliver the 'materials to read' value today; curation is additive, surfaced not silently skipped."
  },
  {
    "id": "R2",
    "item": "One pending item remains: brief scheduling (overnight pre-generation + day/week view).",
    "why_skipped": "Built in order; it's the last slice in this 'build the rest' pass and needs a cron + a cached-brief store, so it's its own build.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null
  }
]
```
