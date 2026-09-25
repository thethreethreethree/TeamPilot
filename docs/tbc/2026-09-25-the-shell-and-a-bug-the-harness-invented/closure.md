# CLOSURE — the shell, and a layout bug the harness invented

## What is true now

The Sales Coach shell is photographed in both themes at both widths, and its 9 white-alpha sites are
correct — they sit on a ground that is dark in both themes. The visual harness now contains
`position:fixed` surfaces inside the viewport it simulates, so it can no longer invent the clipping it
invented today.

## The finding

The most alarming picture of the day — a phone nav with a tab cut in half — was false, and it was
false for a reason the photo could not show. What caught it was arithmetic: the tabs were spaced for a
488px screen in a 430px picture. **A screenshot is a measurement, and a measurement whose numbers do
not add up is reporting on the instrument.**

## Residual

```json
[
  {
    "id": "R1-pattern-interrupt-truncated",
    "item": "Desktop sidebar: the NEW badge truncates 'Pattern Interrupt' to 'Pattern Interr…'.",
    "why_skipped": "A label/badge decision, not a colour or layout defect.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-25T13:20:00Z",
    "outcome": "OPEN, for the founder."
  },
  {
    "id": "R2-28-white-alpha-remain",
    "item": "VoiceEnrollment 5, TodaysMetrics 4, then 2s and 1s across 12 files; roleplay's 2 are the deliberate bg-brand-shell composer.",
    "why_skipped": "One surface at a time.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-25T13:20:00Z",
    "outcome": "OPEN. The shell result is a warning for the rest: any site inside a fixed-colour ground is correct and must be checked for that BEFORE it is counted."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
