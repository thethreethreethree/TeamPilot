# BUILD — ten error messages that could not be read on cream

### Mode-aware reds, dark preserved exactly

- **write-path:** `text-red-600 dark:text-red-300` and `text-red-600 dark:text-red-400` across
  `DoorLog.tsx` (2), `PitchDetail.tsx` (2), `PitchPerformance.tsx` (1), `TodaysMetrics.tsx` (1) and
  `meeting/MeetingPrepUp.tsx` (4).
- **read-path:** `npm run visual -- pitchPerformance`, before and after, in both themes:

```
$ npm run visual -- pitchPerformance
      Tests  3 passed (3)
  6 image(s) in artifacts/visual/
exit 0
```

`text-red-300` is #FCA5A5 and `text-red-400` is #F87171 — around 2:1 on cream, well under AA. The
light capture went from pale salmon to a strong #DC2626; the dark capture is unchanged, which was
the point of adding a variant rather than replacing the value.

A rep knows what these look like today. A single mode-agnostic red would have been a redesign
nobody asked for, in exchange for a fix nobody needed in the mode they use.

**Two excluded after reading them, not after matching them:** sites already carrying a `dark:`
sibling, and `LiveCoachingPanel:523` — a pulsing badge on its own `bg-red-500/15` fill, which is a
different contrast problem and needs looking at rather than sweeping.

### A capture of the report card in three states

- **write-path:** `src/test/captures/pitchPerformance.capture.tsx` — populated, empty, and failed.
- **read-path:** six images, each opened; the failed state is the one that produced the finding.

Three states because the interesting ones are not the happy path, and because this component
tracks `loading` and `error` separately — the distinction its own header names: a load error is
honest, never a false "no pitches".

### The fixture that produced a fourth phantom

- **write-path:** `knock_outcome` values in that capture's fixture, with a comment naming what it
  was and why.
- **read-path:** the rendered badges — "Sold", "Go Back", "Not Int." — instead of raw enum text.

My first fixture used `follow_up` and `no_sale`. `OUTCOME_BADGE` covers all five `knock_outcome`
values and the route reads `door_knocks!inner(outcome)` (`report-card/route.ts:32`), so the raw
rendering was my wrong vocabulary, not a missing label.

The comment in the fixture records the schema's five `outcome` vocabularies, because the next
person writing a fixture for any screen in this product faces the same choice with nothing at the
call site to guide them.

### A fifth copy of the map that exists to stop copies

- **write-path:** `outcomeLabel` imported in `RecordingsTab.tsx`, replacing a local `OUTCOME` map.
- **read-path:** the 25 RecordingsTab render tests, unchanged — including the one asserting
  "Not counted" beside an outcome, which renders through the new path:

```
$ npx vitest run src/components/sales-coach/__tests__/RecordingsTab.render.test.tsx
      Tests  25 passed (25)
exit 0
```

`src/lib/coach/v5/outcomeLabels.ts` says why it exists in its own header: *"Shared Sales Coach
outcome labels + display order (audit F7 — §A21, one source instead of four copies)."*

`RecordingsTab.tsx:80` held `{ sold: "Sold", follow_up: "Follow-up", no_sale: "No sale" }` — three
strings identical to that module's first three entries — with a `?? outcome` fallback identical to
the one `outcomeLabel` already applies. Written AFTER the consolidation that deleted the first four.

The reasoning that produced it is visible and was not careless: `pitch_scores.outcome` allows only
three of the five values (0252:99), so a three-entry map looked right. That is the same reasoning
behind the four copies F7 removed.

**Deliberately NOT consolidated:** `PitchPerformance`'s `OUTCOME_BADGE` renders `knock_outcome`
(0215) — a different vocabulary, different values, and per-outcome styling as well as labels.
Merging them would be the opposite error, and it is the error my own fixtures made four times
today.
