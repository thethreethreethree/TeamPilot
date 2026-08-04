# CLOSURE — After-Pitch "Your read" prominent button

## What shipped
On the After-Pitch screen, the "Your read" section header is now a bold, high-visibility amber button (bulb
icon + label + Tap-to-open/Hide hint + glow) instead of a quiet text toggle — so the rep can find it at a
glance. Implemented as an opt-in `prominent` variant of the shared `CollapseToggle`, applied only to "Your read".

## Un-named reliance (not self-evident)
- **Opt-in, not global.** `prominent` is a per-call prop; only "Your read" passes it. Do NOT restyle
  `CollapseToggle` globally — "Score Assessment Review" and any future toggles rely on the quiet default.
- **Only the appearance changed.** When "Your read" shows is unchanged: Standard auto-opens, Expert collapses,
  and a no-narrative call still omits the whole section (`!narrative.hasSignal`). If a rep still doesn't see it
  on a given call, it's the no-signal case, not this button.
- **The delivered image is a faithful mock, not a live capture.** The live after-pitch page is owner-private
  (RLS) and needs real call data, so it can't be headlessly screenshotted; the mock uses the exact shipped
  button styling/classes.

## Flagged, not fixed (§3.3)
- The transcript-collision item (#2 in the founder queue) means some sessions' "Your read"/scores were generated
  on multi-take transcripts. Making the button visible doesn't change that — it's a separate, already-flagged
  data fix.

## Residual (A36)
```json
[
  { "id": "RES-01", "item": "No automated test of the prominent-toggle rendering.", "why_skipped": "Presentational, opt-in variant of an existing component; verified by typecheck + rendered mock. A unit test of the class output has low value.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-04T00:11:02Z", "outcome": "OPENED — typecheck clean (exit 0); render-confirmed via the delivered mock." },
  { "id": "RES-02", "item": "Live screenshot not produced (auth/RLS-gated surface).", "why_skipped": "The after-pitch screen is owner-private and needs real call data; a faithful mock with the shipped styling was delivered instead.", "confidence_it_does_not_matter": "high", "opened_at": null, "outcome": null }
]
```
