# CLOSURE — thirteen of thirteen

## What is true now

Every one of the thirteen Sales Coach surfaces has been rendered in both themes and looked at, one
image at a time. One Liners, the last of them, renders correctly on cream without a single change
to its own file.

## The pass, honestly totalled

Thirteen surfaces. **Fifteen real defects. Eight phantoms. Four screens that were already clean.**

The phantoms are the part worth keeping, because every one of them was convincing:

- A clipped button that was my own harness wrapper.
- A stretched card, same cause.
- A crash from a catch-all `{}` feeding a route a body it cannot return — three separate times,
  the last two in the same capture file, the second of those **directly beneath the comment
  warning about it**.
- A `0.129%` close rate from feeding a ratio into a field that carries a percentage. I nearly
  reported a 100× bug to the founder hours before an investor demo.
- `A+ 72/10` under a header reading "last 0 scored calls" beside "14 of 18" — three
  independent-looking defects from one out-of-range fixture number.
- `-6750` on the rep's headline gauge, in both themes, present in the DOM, next to a correctly
  drawn 74% arc. Settled by arithmetic on the easing function, not by a grep: `74 × (1-(1-p)³) =
  -6750` solves to `p ≈ -3.5`, a jsdom time-origin offset and nothing a browser can produce.

Eight of twenty-three findings were not real. **A tool that produces one false finding in three
would be worthless if its output were trusted rather than checked** — which is the argument for
the discipline that ran alongside it: read the producer, not the render.

## What the pass actually bought, beyond the fixes

A thing a grep could not have told anyone: **the eleventh surface was an instance and the twelfth
was the producer.** Eleven screens were fixed one at a time while `ui/deck.tsx` — 306 lines, six
importers, twenty-two cards — sat one import away. The thirteenth surface is the proof, because its
cards render correctly on cream and its own file is untouched and its own grep is empty.

And a thing only a person looking could have told anyone: on cream, half of a rep's roleplay
conversation had no bubble, a rep could not read the sentence they were typing, and the three dials
on the primary screen had no rings.

## Residual

```json
[
  {
    "id": "R1-the-error-state-is-a-dead-end",
    "item": "One Liners renders a 500 as one sentence with no retry and no link. `TodaysMetrics.tsx:83` and PitchPerformance both offer Retry in the same situation.",
    "why_skipped": "A behaviour change, outside 'render every screen and look', raised on the day of an investor demo.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-24T09:21:20Z",
    "outcome": "OPEN, as a proposal for the founder. The clause it violates (§1.5.1 layer 3) is cited IN THIS FILE thirty lines below, applied to the neighbouring empty state."
  },
  {
    "id": "R2-the-sweeps-checked-three-properties-of-ten",
    "item": "Every white-alpha sweep today matched `border|bg|text`. `stroke`, `fill`, `divide`, `ring`, `from`, `to` and `via` were never counted.",
    "why_skipped": "Re-running every sweep with the full property list is a pass of its own.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-24T09:21:20Z",
    "outcome": "OPEN, and it is now the standing gate proposal in place of a fifth deferral of `paleText`. The 256-site figure quoted all day is an undercount of unknown size — `DoorDial`'s `stroke-white/15` was invisible to all of it and was found by looking at a picture."
  },
  {
    "id": "R3-nine-dark-inputs-on-cream-grounds",
    "item": "The `bg-black/30 border-white/10 text-primary` input recipe survives at 9 sites across sessions/page.tsx, StartSessionPanel, CoachTogglePanel and TaskRefinementPanel.",
    "why_skipped": "Out of the founder's chosen scope; four are outside Sales Coach entirely.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-24T09:21:20Z",
    "outcome": "OPEN. All nine sit on `bg-base`, where the result is a mid-grey box rather than illegible text — the severity of this class is set by the ground, and these grounds are cream. Ugly, not broken."
  },
  {
    "id": "R4-two-unguarded-wire-casts",
    "item": "`PitchBreakdown.tsx:95` and `TodaysMetrics.tsx:179` both read wire fields unguarded in ways that throw through the render.",
    "why_skipped": "Both routes always send the field; latent, not live.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-24T09:21:20Z",
    "outcome": "OPEN. In both cases the correct pattern is within three lines of the defect."
  },
  {
    "id": "R5-the-populated-state-came-from-a-fixture",
    "item": "Whether `/strategy-library` returns `context`, `sessionLabel` and `outcome` populated for a real rep is not established by this capture.",
    "why_skipped": "It needs the live route with real data, which no capture can supply.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-24T09:21:20Z",
    "outcome": "OPEN, and true of every populated capture in this pass. A capture proves how a shape RENDERS, never that the shape ARRIVES. Worth stating plainly now that the pass is being called complete."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was created, edited, moved, restyled or removed.
Six captures were generated from this project's own components into `artifacts/visual/`
(git-ignored) and each was opened and described individually.

Still unopened: six of the seven PDFs in `docs/SYSTEM UPDATES AND REVISION 09-22-2026/`, the 16
images in `public/`, the 11 in `docs/sales-coach/webstore-promo-kit/assets`, and the two WhatsApp
JPEGs in that folder.

No Sales Coach screen remains unrendered.
