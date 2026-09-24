# BUILD — one capture, two states, one retraction

### A capture that drives both states of Pattern Interrupt

- **write-path:** `src/test/captures/patternInterrupt.capture.tsx`, with an `EMPTY` wire and a
  `POPULATED` one carrying a single open pattern.
- **read-path:** `npm run visual -- patternInterrupt` — four images, each opened and described:

```
$ npm run visual -- patternInterrupt
      Tests  2 passed (2)
  4 image(s) in artifacts/visual/
exit 0
```

Both states, because a room can land on either: the empty one is every account today, and the
populated one is what the backfill produces. Capturing only the first would have left the second
unlooked-at — the same mistake this build exists to correct, one level down.

Every field is copied from its type rather than invented: `Wire` at `PatternInterrupt.tsx:49`,
`PatternRow` at `readPatterns.ts:24`, `StatusVerdict` at `status.ts:103`. A fixture built from the
component's JSX is how a capture photographs an error state and calls it the screen — and three
phantom findings earlier today came from exactly that.

Both boards rendered on the first run. The two failures were my matchers: `/pattern/i` and
`"Trucks in the area"` each match several nodes on a working screen, which is a fact ABOUT the
screen working.

### The brief, corrected in place

- **write-path:** `docs/DEMO-READINESS-2026-09-24.md` — section 7 added, sections 3 and 5 amended to point at it.
- **read-path:** the document itself; section 3's bullet and section 5's closing line no longer say the opposite
  of section 7.

A correction appended at the end while the original claim still stands earlier in the same document
is worse than no correction — a reader who stops at section 5 leaves with the wrong advice. Both were
edited, not just supplemented.

**What the correction does NOT say** is that Pattern Interrupt is verified. The surface is sound;
its data is untested, because real detection has never produced a pattern. That is a narrower
caution than the one it replaces, which is the point.
