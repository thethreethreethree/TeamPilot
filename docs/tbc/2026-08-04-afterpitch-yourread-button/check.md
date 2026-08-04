# CHECK — After-Pitch "Your read" prominent button

## Audit (H1)
- "Your read" now renders as a high-visibility amber button: bulb icon, bold title, amber border + fill + glow,
  and a `Tap to open` (collapsed) / `Hide` (open) hint with a rotating chevron. It reads clearly as a button and
  stands apart from the quieter "Score Assessment Review" toggle just above it.
- Behaviour preserved: `prominent` only changes the toggle's appearance — the `open`/`onToggle` wiring, the
  Standard `defaultOpen` auto-open, the Expert collapsed default, and the `!narrative.hasSignal → null` omission
  are all unchanged.
- Ripple safe: `prominent` is opt-in; only the "Your read" toggle passes it, so every other `CollapseToggle`
  usage renders exactly as before.

## Class sweep (A26)
Checked all `CollapseToggle` usages in the file — "Your read" (now prominent) and "Score Assessment Review"
(unchanged, default). No other component shares the toggle. No collateral restyle.

## Findings
no findings — presentational, opt-in, behaviour-preserving. (Related, separately tracked: the transcript-
collision item #2 — some sessions' "Your read"/scores were generated on multi-take transcripts; that's a data
issue, not this button change.)

## Verification (A38)
```
$ npx tsc --noEmit -p tsconfig.json
(no after-pitch errors) tsc_exit=0
```
Rendered a faithful mock of the new button (exact colours/classes) in the after-pitch card — collapsed and
expanded — to confirm the look (delivered to the founder as AFTER-PITCH-Your-Read-Button-2026-08-04.pdf). The
live screen is owner-private (RLS) so it can't be headlessly screenshotted; the mock uses the shipped styling.
Full `npm run check` is the CI gate on push.
