# BUILD

### `/sessions` — eight sites and ten tints

- **write-path:** seven `border-white/[0.07] bg-white/[0.02]` → `border-default bg-surface`, one
  `divide-white/[0.06]` → `divide-default`, one `hover:bg-white/[0.02]` → `hover:bg-surface-raised`,
  two `bg-black/30 border-white/10` → `bg-surface border-default`; ten raw tints mode-split by
  guarded regex, verified by re-grep to zero.
- **read-path:** `sessions-manager`, `sessions-rep`, `sessions-expert`, `sessions-empty`, both
  themes.

**The prediction was wrong, and it was wrong in the direction that matters.** I told the founder
this input recipe was "ugly, not broken" on a `bg-base` ground, and they declined a sweep on that
basis. On cream the search field and the three filter dropdowns render as solid mid-grey slabs —
they read as DISABLED CONTROLS, which is not ugly, it is an inverted affordance.

### The two manager views

- **write-path:** four `divide-white/5` → `divide-default` and three `border-white/15` →
  `border-default`, across `StandardSessionsManagerView.tsx` and `StandardAnalyticsManagerView.tsx`.
- **read-path:** `sessions-manager`, both themes — the roster's row dividers exist in dark and
  vanished on cream.

### `StartSessionPanel` — the honesty notice

- **write-path:** two `bg-black/30 border-white/10` → `bg-surface border-default`;
  `text-white/55` → `text-secondary`; `text-white/75` → `text-primary`.
- **read-path:** `sessions-expert`, both themes, cropped to the panel.

**"Client / campaign (required)" rendered as a grey slab** above an already-disabled Start button —
the required field of the form that begins a coaching session, looking unavailable.

And the one that matters more. In dark this line renders:

> On video, your mic hears **your** side — not the prospect's audio from the far end of the call.
> The coach guides your delivery: pacing, filler, framing, and the words you choose.

On cream it was **white text on near-white**. Present in the DOM, confirmed by reading the capture
JSON; entirely absent from the picture.

The comment above it, written by whoever added it: *"§3.4 honesty: on video the device mic hears
the REP's side only … Say so plainly so the rep's mental model matches what the coach can actually
do."* **The product's honesty notice — the sentence that exists to stop a rep expecting something
the system cannot do — was invisible in light mode.**

### `EloMeter` — a fourth spelling of the same class

- **write-path:** `text-white/10` → `text-ink-200 dark:text-white/10` (the gauge track),
  `text-white/50` → `text-ink-400 dark:text-white/50` (the 1500 "standard" tick).
- **read-path:** a new `analytics-expert` capture, both themes, cropped to the badge.

Both are `text-white/N` used as `currentColor` for an SVG **stroke**. Not `stroke-white`, not a
border, not a background — a fourth spelling, invisible to every sweep run today. On cream the
gauge had no track and no standard tick, and the tick is the whole point: `EloMeter.tsx:11` says it
exists so "above / below the standard reads at a glance".

### The captures

- `sessionsList.capture.tsx` (new): three branches plus the empty state, mode mocked through a
  mutable holder.
- `salesCoachAnalytics.capture.tsx`: an Expert variant, because `AgentEloBadge` renders only when
  `!isStandard` (`analytics/page.tsx:189`) and had therefore never been photographed.

```
$ npm run check
 Test Files  713 passed | 1 skipped (714)
      Tests  5511 passed | 15 skipped (5526)
CHECK_EXIT=0
```
