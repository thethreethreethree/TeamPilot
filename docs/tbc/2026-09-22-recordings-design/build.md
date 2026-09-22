# BUILD — the design was the specification, and five parts of it were not built

## What was built

Four of the five, plus the wire field one of them needed. The fifth is two buttons with no
destination, and it is not built on purpose — see below.

### The all-time count

- **write-path:** `src/lib/coach/recordings/readRecordings.ts` — `count: "exact"` rides on the
  existing query, and `readPitchRecordings` returns `{ rows, capped, total }`.
- **read-path:** `RecordingsTab` renders it, and hands it upward for the tab label. The route
  already spreads `list`, so it passes through untouched.

**`rows.length` could not supply this number.** The read is bounded at `LIST_LIMIT` and the surface
already said so, so for any rep with more the two differ and "100 all time" would be a page
presented as the whole set — the exact claim three of today's builds removed. Same shape as
`reviewFlagsTotal` (0264) and the bell's `total`; third time today.

### RECENT RECORDINGS · N all time

- **write-path:** a header row above the `<ol>` in `RecordingsTab`.
- **read-path:** two render tests — the count present, and **absent when the response carries none**,
  because an older bundle must not render "0 all time" over a list with rows in it.

### The bounded-list line, which now says what it is showing OF

- **write-path:** the `list.capped` branch in `RecordingsTab`.
- **read-path:** a render test with `capped: true, total: 412`, asserting the rendered sentence.

Was: *"Showing the most recent 100. Older recordings are on the record and not on this list."*
Now: *"Showing the 1 most recent of 412…"*

Two problems in one sentence. It named the bound and not the set — the same shape as the attention
queue and the bell. And it named `100` literally, a second copy of `LIST_LIMIT` that would drift the
first time that moved (§2.2). Both numbers come from the data now.

### The score as arithmetic

- **write-path:** the detail heading in `RecordingsTab`.
- **read-path:** a render test asserting each term and the total.

```
was:   78.5 · Solid · base 62.0 · bonus 20.0 · violations −3.5
now:   58.5 base  +5.0  −2.0  =  61.5 · Solid
```

The numbers were all there already. What was missing is that **they add up in front of the reader** —
a manager arguing with a score needs the sum working, not four values and a comma. The total is
large and in the accent colour, as drawn.

### Key moments · click to jump

- **write-path:** the `Key moments` heading in `RecordingsTab`.
- **read-path:** a render test asserting the affordance half is on screen when a moment exists.

The rows have been clickable since they were built. Nothing said so.

### The tab labels

- **write-path:** `CoachAssessmentBoard` — `Assessment` → **`Overview`**, and
  `Recordings` → **`Recordings (7)`** once the count arrives.
- **read-path:** `recCount`, reset to `null` on every rep change. Carrying one rep's count onto
  another's tab is the kind of quietly-wrong number this session has been about.

`null` renders as plain `Recordings`, not `(0)` — an absence, not a claim.

## What was deliberately NOT built

**"Open pitches" and "Open full coaching notes".** Neither has a destination in the design or in the
product. Wiring them to a guess would be worse than leaving them out, and it is the founder's call
where they go.

**`Maple Ct · Sold`.** The outcome is in the wire and is not rendered; **the street is not in the
schema at all** — `door_knocks` (0215) has no address column and no later migration adds one. That
line needs data the product has never asked a rep for.

**"Rank #5 this week".** The build says "#5 this period" and is RIGHT: the page has a
Day/Week/Month/All-time toggle, visible in the design's own header and set to Week in the capture.
Hard-coding "this week" would make the subtitle lie on three of four settings. A conformance pass
that copies a snapshot's wording into a surface with a control the snapshot does not show is how
conformance makes a product worse.

## Ripple

- **A fifth new wire field today.** `total` is additive; `rows` and `capped` keep their shapes, so a
  browser holding an older bundle renders exactly what it did.
- **A stale-closure guard was removed**, not added. The first version kept a "have I notified" flag in
  state and read it inside the effect; lint caught it and was right. The effect runs once per
  `repId` and the fetch resolves once per run, so the case the flag guarded is unreachable — and a
  flag guarding an unreachable case will be wrong about a reachable one later.
- **No migration, no new endpoint, no schema change.**
