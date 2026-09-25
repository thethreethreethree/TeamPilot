# BUILD — and a fix that had to be fixed

### Round one: the sites

- **write-path:** `[id]/page.tsx` — four `border border-white/[0.07] bg-white/[0.02]` sections and
  one `? "border-default bg-white/[0.02]"` → `border-default bg-surface`; ten raw tints mode-split.
  `PivotAndScores.tsx` — `bg-white/\[0\.0\d\]` **by pattern** (it carries `[0.01]`, `[0.02]` AND
  `[0.04]`, three hundredths of the same intent), the timeline rail `border-l border-white/10` →
  `border-l border-default`, the unlit timeline nodes `bg-white/25` → `bg-ink-400
  dark:bg-white/25`.
- **read-path:** `session-detail` and `session-detail-thin`, both themes.

The pattern replace is the `TeamTrainingBriefPanel` lesson applied deliberately: an exact-string
edit would have caught one of the three alphas and reported the file clean.

Both files now report **0** unfixed sites.

### Round two: MY FIX WAS INVISIBLE TOO

The render showed the "Topics discussed" chips — `pricing`, `contract length`, `install timing` —
as **bare text with no pill**, beside a "Spectrum" competitor chip that has one. Which is the same
one-has-it-the-others-do-not disguise as DoorLog's KPI tiles, one build ago.

So I had already replaced `bg-white/[0.04]` with `bg-surface`. And `bg-surface` is:

- **white** on light — on a card whose ground is already `bg-surface`. White on white.
- **ink-900** on dark — on a card whose ground is already ink-900.

**I made dark WORSE.** `bg-white/[0.04]` at least produced a faint chip there; `bg-surface` produced
none. A fix that was correct as a token substitution and wrong as a rendering, in both themes, and
nothing but the picture could have said so.

- **write-path:** the topic chip and the score cell → `bg-surface-raised`.
- **read-path:** the same crops, re-shot.

**`surface` is the token for a card on the page ground. `surface-raised` is the token for something
sitting ON a card.** Every fix in this session has substituted `bg-white/[0.0x]` → `bg-surface`
without asking which of those two it was, because until now every one of them happened to be the
first kind.

### The capture

- **write-path:** `sessionDetail.capture.tsx`, two states, wrapped in `ThemeProvider` +
  `ToastProvider` (both mount at `layout.tsx:144`/`:8`).

```
$ npx tsc --noEmit -p tsconfig.json → exit 0
$ npm run visual -- sessionDetail   → 2 passed, 4 images
```
