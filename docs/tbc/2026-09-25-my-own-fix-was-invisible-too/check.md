# CHECK

## Commands

```
$ npx tsc --noEmit -p tsconfig.json → exit 0
$ npm run visual -- sessionDetail   → 2 passed, 4 images
$ npm run check                     → see closure
```

## It was looked at

**`session-detail.light`, after round one** — "← Back to sessions"; "Conversation summary" over a
one-line read; a bordered "Conversation timeline" card with two moments (0:08 Opener, 1:12
**Breakdown** with a cooling arrow, its customer and rep lines, and a "Try instead" box carrying
the correct line); a cream/amber "Pivot moment · lost ground" card; a bordered "Competitors
mentioned / Topics discussed" card; "Full transcript" collapsed; "Pitch Score" with "How points
work". **The three topics render as bare text; the one competitor renders in an ember pill.**

**`session-detail.dark`, after round one** — the same layout, and **the topics are bare text there
too** — which they had not been before my change.

**`session-detail.light`, after round two** — the three topics in grey pills, matching the shape of
the ember competitor pill beside them.

**`session-detail.dark`, after round two** — the same pills one step lighter than the card.

**`session-detail-thin.light` / `.dark`** — the branch where the coach found nothing to read: "Not
enough of the conversation yet to write an honest review."

## Findings

### 22 sites in one route's tree

class: the session's standing class
sweep: render-tree, by pattern → `[id]/page.tsx` 9 → 0, `PivotAndScores` 7 → 0
severity: medium

**[OBSERVED]** `PivotAndScores` carries `bg-white/[0.01]`, `[0.02]` and `[0.04]` — three
hundredths of one intent in one file. An exact-string replace catches one.

### MY OWN FIX RENDERED INVISIBLE, IN BOTH THEMES

class: `bg-surface` applied to an element that SITS ON a `bg-surface` card
sweep: not swept — found by rendering the thing I had just changed
severity: high as a method finding, medium as a defect

**[OBSERVED]** After replacing `bg-white/[0.04]` with `bg-surface`, the topic chips render as bare
text on light AND dark. The card behind them is itself `bg-surface`.

**[OBSERVED]** Before my change they were faintly visible on dark. **I made dark worse.**

**[OBSERVED]** `surface` is `#FFFFFF` on light / ink-900 on dark; `surface-raised` is ink-100 /
ink-800 — a step above whatever surface you are standing on.

This is the finding of the build. Every white-alpha fix this session has substituted
`bg-white/[0.0x]` → `bg-surface` without asking whether the element is a card on the page or a
chip on a card. Until this one, every instance happened to be the first kind, so the substitution
was right by luck rather than by reasoning.

### The capture that would have been the same picture twice

**[OBSERVED]** `LiveCoachingPanel` is mounted unconditionally at `:1027`, not behind `status ===
"active"`. An "ended" and a "live" capture would have differed in nothing.

Replaced with the thin state. Recorded because it is the inverse of this session's repeated branch
error: here I assumed two branches existed and there was one, and checking cost one grep.

## What this does not prove

**The other `bg-surface` substitutions in this session were not re-examined.** Every one of them
is subject to the same question — card on page, or chip on card? — and I have only verified the
ones I rendered. **This is now the top residual and it applies backwards through today's work.**

**Two panels sat at "Loading…"** in both captures — the `/why` panel and Pitch Score — because my
fixture does not return shapes they accept. They are unrendered, not broken.

**`SessionRecordingUpload` (3), `LiveCoachingPanel` (2) and `SessionCoachTools` (1)** are in this
tree but below the captured fold or behind a state the fixture does not produce.
