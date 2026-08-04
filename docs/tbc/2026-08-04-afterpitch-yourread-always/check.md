# CHECK — After-Pitch "Your read" shows on every session

## Audit (H1)
- The `Narrative` component no longer returns null when the review is empty; the "Your read" section renders on
  every after-pitch that displays a summary. When `narrative.hasSignal` is true → the real read (strengths +
  opportunities, unchanged). When false → an honest short paragraph ("this call was too short to read yet …").
- Honesty preserved (§3.4): thin calls get an honest state, not a fabricated review. The ≥3-rep-turn quality
  floor in `salesReview.ts` (MIN_AGENT_SEGMENTS) is untouched — it still governs when a *real* read is produced;
  this change only stops the section from vanishing.
- Ripple safe: only the Narrative render changed — API, scores, privacy, and Standard/Expert open behaviour are
  unchanged. On a fully-empty call (no segments → whole summary EMPTY) the page's top-level empty state still
  applies; that degenerate case is unchanged.

## Class sweep (A26)
Checked the two `<Narrative>` render sites (Standard defaultOpen, Expert collapsed) — both now always show the
section. No other component gated on `narrative.hasSignal` to hide content.

## Findings
no findings — behaviour-preserving except the intended always-render; honesty kept.

## Verification (A38)
```
$ npx tsc --noEmit -p tsconfig.json
(no after-pitch errors) tsc_exit=0
```
Full `npm run check` is the CI gate on push. Live behaviour confirmed after deploy by re-opening an after-pitch.
