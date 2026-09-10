# CLOSURE — door home screen: swipeable pager + cash box

The final increment is done: the door screen is now reachable as page 0 of a swipeable two-page mobile Home (the
"make it swipeable" ask), brought to exact parity with the founder's mockup — greeting, target sentence, 26-tick
ember dials, "Tap a dial to log one", and the "Earned today $" cash box — with a manager-set $-per-sale behind
the cash figures. The screen was invisible "in the system" because nothing linked to it; the pager is that link.

## What this increment does NOT do (un-named-reliance half)
- Migration 0248 is NOT applied — the cash box shows dollars only after `npm run db:apply` lands
  `sale_value_cents`; until then it degrades to "sales to goal".
- The dials show real counts and open the quick-log; there is no bare +1 and no "Reset the day" (real events are
  immutable). This is a deliberate, flagged departure from the prototype.
- The pager is only for a Macro-ON rep. A non-Macro rep's home is unchanged; the desktop dashboard is unchanged.
- Runtime device behavior (iOS Safari momentum swipe, snap feel) is not yet founder-tested on a physical device.

## Residual (A36 — read from the TOP of the confidence ranking)
```json
[
  { "id": "R1-pager-remount-reset",
    "item": "Whether opening on page 0 every mount actually holds on iOS Safari, where the back-forward cache (bfcache) can restore a page WITHOUT firing a fresh mount — the case I was most sure a mount effect covers.",
    "why_skipped": "Assumed a React mount always runs on return-to-home; bfcache restore can bypass it.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-10T08:33:00+08:00",
    "outcome": "OPENED. In App Router, navigating Home→other tab→Home unmounts/remounts the page (client navigation), so the mount effect fires and resets to page 0 — the common path is covered. The residual case is a true browser bfcache restore (app backgrounded then reopened) where no mount fires; there the pager keeps its last scroll position. The Home bottom-tap (elostate:home-tab) is the backstop that always snaps to 0. Acceptable for now; if the founder's device test shows a stuck page after app-switch, add a pageshow/visibilitychange listener that resets scrollLeft. Flagged, not fixed." },
  { "id": "R2-sale-value-scope",
    "item": "$-per-sale is a single standing value per rep; it does not vary by product/campaign or over time.",
    "why_skipped": "The mockup shows one flat per-sale figure; a per-product model is more than was asked.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null },
  { "id": "R3-device-swipe-feel",
    "item": "The native scroll-snap swipe feel (momentum, snap resistance) on real iOS/Android.",
    "why_skipped": "Cannot be judged from jsdom/headless; needs the founder's device test (already the gate for going wider).",
    "confidence_it_does_not_matter": "low",
    "opened_at": null }
]
```

## Verification
See check.md — the targeted 4-file suite (18 tests), the visual render-check against the mockup, the held
migration (A34), and the whole `npm run check` output with its exit code.
