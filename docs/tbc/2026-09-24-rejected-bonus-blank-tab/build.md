# BUILD — narrow at the boundary, mark it on the surface, gate the mirror

Four changes across three files. Two remove the defect, one makes the surface survive the next
version of it, one binds the vocabulary to the database so it cannot drift again.

### The boundary stops asserting and starts narrowing

- **write-path:** `asEventType()` and `EVENT_TYPES` in `src/lib/coach/recordings/keyMoments.ts`,
  consumed by the `events` mapper in `src/lib/coach/recordings/readRecordings.ts`.
- **read-path:** two tests in `keyMoments.test.ts` — every CHECK value round-trips, and an
  unrecognised value returns `null` rather than passing through.

Was `type: e.type as "bonus" | "violation"`. A cast at a database boundary is an assertion the row
cannot disprove, which is why it survived every check this repository runs while disagreeing with
the schema.

A row whose type this build does not recognise is now dropped **with a `console.error` naming the
row id and the offending value**. Dropping silently would be the confident-zero shape this codebase
has been bitten by repeatedly; one missing marker is a smaller lie than an empty screen, and the log
is how a fourth CHECK value gets noticed by an engineer rather than discovered by a manager.

### The vocabulary gains the value the database has had since 0254

- **write-path:** `MomentKind` and the `events` member type in `keyMoments.ts`.
- **read-path:** a test asserting a `rejected_bonus` event keeps its own `kind` instead of
  arriving as something with no marker.

`MomentKind` named five values; the column allows a sixth thing this union had never heard of.

### The rubric lookup asks the right table

- **write-path:** the `rubric` ternary in the events loop of `keyMoments.ts`.
- **read-path:** a test asserting the label reads "Gets inside the house or backyard" and
  explicitly **not** `bonus.inside`.

Was `ev.type === "bonus" ? BONUSES_BY_ID : VIOLATIONS_BY_ID` — everything-not-bonus to the
violations table. A rejected bonus **is** a bonus, so it missed, and the label fell back to printing
the raw `item_id` where a human should read English. Inverted to test for `violation` instead, so
both bonus kinds reach the bonus table.

### The surface has a marker for it, and cannot be blanked by the next one

- **write-path:** the `rejected_bonus` entry in `MARKER`, the `markerFor()` accessor, the `shown`
  legend array, and the points class list in `src/components/sales-coach/RecordingsTab.tsx`.
- **read-path:** three render tests — the pitch renders at all, the word "Considered" is on
  screen, and the points span carries `text-muted` and not `emerald`.

Grey dot, label **Considered** — the founder's call, taken through a picker, over hiding the row or
dimming it green. It is the record of a judgement that happened and awarded nothing, which is the
entire reason `storePitchScore` keeps these rows: *"It turns 'the AI didn't see it' into 'it heard
it at 0.62, below the 0.80 floor' — which a manager can settle."*

Three smaller things ride with it:

- `markerFor()` replaces direct `MARKER[m.kind]` at both wire-driven sites. The map stays
  exhaustive by type; this is the second wall, so a value that ever slips past the narrower costs a
  dot rather than the screen. The legend keeps a direct index because its keys are a literal array.
- The legend gains a fifth chip. `violation` is still absent on purpose — it shares both the red dot
  and the word "Missed" with `missed`, so listing it would print the same chip twice.
- The points span goes from two cases to three. `0` was painted by the not-negative branch, so a
  declined bonus rendered **green** — the colour of the one thing it is not.

### The mirror is gated

- **write-path:** `// enum-source: pitch_score_events.type` above `EVENT_TYPES`.
- **read-path:** `npm run enum:audit`, which reports 11 declared mirrors and matches all of them;
  deleting `rejected_bonus` from the array fails it with `MISSING: rejected_bonus`.

The marker's first placement was above `export type EventType = (typeof EVENT_TYPES)[number]` and
the audit reported **all three values missing** — it reads from the marker to the first `;` and
collects quoted strings, of which a derived type has none. Moved onto the array.

Worth recording plainly: the gate caught the author's own opt-in being malformed, within a minute of
it being written. That is A30's requirement — a check that fails without the author's cooperation —
working on the author.
