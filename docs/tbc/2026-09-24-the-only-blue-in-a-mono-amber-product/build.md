# BUILD — the debt, and what the render found beside it

### The debt: the button, seen

- **read-path:** `npm run visual -- calibration`, both themes.

The "Submit & compare" button renders as a solid ember bar with near-black text, matching every
other primary button in the module. **The blind fix from the previous build is confirmed correct.**

That is the whole of what this capture was for. What follows was not predicted from source and
could not have been.

### The only blue in a mono-amber product

- **write-path:** `accent-ember-400` added to five native controls —
  `CalibrationTool.tsx:120` (range), `MeetingCoachingPanel.tsx:235`,
  `team/page.tsx:520`, `finance/contractors/page.tsx:261`, `finance/controls/page.tsx:570`
  (checkboxes).
- **read-path:** the `calibration` pair, cropped to the sliders.

The five score sliders — the primary input of this screen, where a manager hand-scores each
dimension — rendered in **bright Chrome blue**. A native `<input type="range">` with no
`accent-color` uses the browser's default, and this product's own brand doc is mono-amber: the
After-Pitch page's comment says it in words, *"Our mono-amber identity, NOT the PDF's blue/red …
per docs/BRAND.md + tokens.ts ('no red')."*

**The convention already exists and is used ten times**: `accent-ember-400`, on checkboxes and
inputs across CRM, care settings, problems, departments, chats and `LiveCoachingPanel`. These five
were the ones that missed it.

### The sweep, and two wrong counts before the right one

`grep 'type="range"'` finds three. `RecordingsTab.tsx:551` already carries `accent-ember-400` — the
audio scrubber — so it is correctly out.

Widening to every native control that consumes `accent-color` (range, checkbox, radio) needed a
real scan, and the first one **reported 18 by truncating each element at the first `>`** — which
lands inside `onChange={(e) => …}`, cutting off a `className` that comes after it. Twelve of those
eighteen were false: `crm/[id]:831` was flagged while its `accent-ember-400` sat six lines below.

Rewritten to scan to the tag end at brace-depth zero: **6**. Then two of those six were checked by
hand and excluded for cause:

- `RecordingsTab:551` — already has the class.
- `WowDifferentiator:87` — `className={styles.range}`, and the CSS module sets `opacity: 0` and
  `appearance: none`. It is an invisible drag surface laid over a custom divider, so it has no
  accent to colour.

**Five offenders, each verified individually.** The pattern held from this morning: a count from a
scanner is a hypothesis until the members are read.

```
$ npm run visual -- calibration → 2 passed, 4 images
$ npx tsc --noEmit -p tsconfig.json → exit 0
$ npm run check → 714 files, 5513 passed, CHECK_EXIT=0
```
