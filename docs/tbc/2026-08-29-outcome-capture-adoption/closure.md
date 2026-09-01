# CLOSURE — outcome-capture adoption prompt

## What shipped
A skippable "how did it go?" intercept on Start Next Door, so a rep who'd otherwise leave the outcome blank logs it
in one tap at the move-on moment. This is the adoption lever for Layer-1 KPIs, which read "building" not because
capture is missing (it exists + fires) but because reps used it on only ~7-30% of sessions. It reuses the existing
`recordOutcome` write chokepoint — no new endpoint, no forced field (a forced outcome yields garbage taps, §3.5).

## Verification (A38)
`npm run check` on the commit run. The write path is route-tested; the intercept flow is founder-visual-verify (no
render harness for this client page). Typecheck clean.

## The correction on the record
My first read this session claimed "no outcome-capture path exists" — that was WRONG. The control exists on the
After-Pitch page (Standard) and the session page (Expert), routes through `/[id]/outcome`, and writes the column
the KPI reads. The live per-week capture rate (4/59, 12/161, 7/25…) proves it fires. The real gap is adoption. This
build fixes the adoption, not a phantom missing feature.

## Residual (A36 — explicit)
```json
[
  {
    "id": "KPI-R3",
    "item": "Layer 1 will still take TIME to fill even with better capture: the Understanding Gate needs >=5 outcome-marked sessions PER REP before conversion/close/revenue un-gate. A rep marking outcomes from today reaches that in ~a week of normal volume; it will not populate instantly.",
    "why_skipped": "This is the honest Understanding Gate at work, not a bug — surfaced so the founder expects a fill curve, not an instant flip.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-29T11:15:00+08:00",
    "outcome": "OPEN — expected behaviour; watch the per-rep capture rate climb over the next week."
  },
  {
    "id": "KPI-R4",
    "item": "The Expert session-page capture + the Standard inline After-Pitch capture also exist but sit below the fold; only the Start-Next-Door intercept was added. If adoption is still low after a week, elevating those (or an intercept on the Expert session page's leave action) is the next lever.",
    "why_skipped": "The founder chose the Start-Next-Door intercept as the single highest-leverage change; measure it before adding more.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-29T11:15:00+08:00",
    "outcome": "OPEN — measure the intercept's lift first."
  }
]
```
