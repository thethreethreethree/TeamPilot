# CLOSURE - A manager can mark a rubric item "Doesn't apply"

## What is true now

Answering a dispute, a manager can set any rubric item to "Doesn't apply to this call" with a reason. Its points leave
the section's maximum and the section is scaled back to full, as with Objection handling; the correction is logged and
the rep is told. The AI never marks N/A. Team rates and patterns leave an N/A item out for that pitch.

## Residual

```json
[
  {"id": "R1-measure", "item": "Whether N/A makes scores fairer, or is used to soften them, is unmeasured.", "why_skipped": "Needs managers' use over weeks (§4).", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-24T20:30:00Z", "outcome": "Count N/A corrections per manager and item once there are some."},
  {"id": "R2-mandatory", "item": "No per-item 'mandatory' flag (Gong's other half of F15.5): every item can be marked N/A except the last in a section.", "why_skipped": "Not asked for; the rubric is fixed in code, not edited per company.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-24T20:30:00Z", "outcome": "Accepted."},
  {"id": "R3-score-page", "item": "Managers correct only from the dispute queue; there is no 'correct this item' on the score page itself.", "why_skipped": "Existing design (corrections answer disputes); unchanged here.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-24T20:30:00Z", "outcome": "Accepted."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
