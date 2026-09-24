# BUILD — the producer, not the instances

### The deck kit

- **write-path:** `src/components/sales-coach/ui/deck.tsx`, seven substitutions.
  - `DeckCard` (:57) and `DeckStat` (:114): `border-white/[0.07] bg-white/[0.02]` →
    `border-default bg-surface`.
  - `DeckGhostButton` (:214): `border-white/10 … hover:border-white/20` → `border-default …
    hover:border-strong`.
  - `DeckPill` muted (:244): `border-white/10 bg-white/[0.03]` → `border-default bg-surface`.
  - `DeckMeter` (:299): track `bg-white/[0.06]` → `bg-surface-raised`.
  - `DeckStat` and `DeckPill` emerald/amber tones: `-300` → `-600/-700 dark:-300`.
- **read-path:** `npm run visual` — 38 captures across 13 files, all opened.

No `white/N` or `black/N` remains in the file. All 22 `<DeckCard>` callers were read before the
change; none overrides the base border or fill, so nothing could be fighting it.

### The roleplay page

- **write-path:** 13 replacements in `roleplay/page.tsx`. Prospect + typing bubbles →
  `bg-surface-raised`; unselected persona cards → `border-default bg-surface`; the situation input
  → `bg-surface`; two icon tiles → `bg-surface`; two `divide-white/[0.06]` → `divide-default`;
  four `amber-300/400` and one `emerald-400` → mode-split.
- **read-path:** `roleplay-setup`, `roleplay-chat`, `roleplay-review`, both themes.

### The composer — the opposite fix

- **write-path:** `:541` `text-primary placeholder:text-muted` → `text-white
  placeholder:text-ink-400`; `:534` `text-muted hover:text-brand` → `text-ink-400
  hover:text-ember-400`. The `bg-black/30` and `border-white/10` around them are LEFT ALONE.
- **read-path:** a new `roleplay-composer` capture with a sentence typed into the field, cropped
  to the composer strip, both themes.

Before: the typed sentence rendered near-black on the near-black field in light mode — barely
discernible, and it is the only input on the page. After: bright white, identical to dark.

The container is deliberately dark in both themes. Inside such an island the white-alpha values are
correct and the theme-following TEXT token is the defect — the exact inverse of every other fix
today, which is why "replace white/N with a token" as a blanket rule would have made this one
worse.

### The dials — found because a broken capture was repaired

- **write-path:** `DoorDial.tsx:121` unlit tick `stroke-white/15` → `stroke-ink-300
  dark:stroke-white/15`.
- **read-path:** `macro-home`, both themes.

The `macro-home` capture waited on the "Exit Macro Mode" button, which renders in the HEADER before
anything loads. Every previous photograph of this screen — including the ones used to verify this
morning's one-way-door fix — showed a correct header above a spinner reading "Loading your day…".
The body was never in shot. With a second wait on the loaded day, the three dials appeared, and on
cream they had no rings: only the LIT ticks were visible, so "3 of 80" rendered as a single ember
tick floating below the number. The comment at `DoorDial.tsx:13` says "unlit = a muted stroke",
which is the right intent at a value that only achieves it on black.

### The count-up clamp — one class, three copies

- **write-path:** `Math.min(1, …)` → `Math.max(0, Math.min(1, …))` in `RepArena.tsx:64`,
  `landing/CountUp.tsx:33`, `landing/wow/WowSections.tsx:237`.

The rAF timestamp is the moment the frame's callback list began processing and can precede a
`performance.now()` taken inside that same frame. easeOutCubic AMPLIFIES a negative progress —
`1-(1-p)³` falls away cubically — so a small negative `p` produces a large negative number. Two of
the three copies are on the public marketing site.

### The harness

- `stubBrowserApis` now stubs `Element.prototype.scrollTo`/`scrollIntoView` (absent in jsdom; their
  absence throws through React's commit phase and reads as a product crash), and answers
  `matchMedia` PER QUERY — `prefers-reduced-motion` true, everything else the caller's `light`.
  jsdom never advances rAF, so a blanket `false` photographs frame zero forever.
- `todaysMetrics.capture.tsx` now serves `pitch-score/breakdown` and `todays-metrics` explicitly
  instead of letting the catch-all `{}` answer them.
- `macroHome.capture.tsx` waits on the loaded body as well as the header.
