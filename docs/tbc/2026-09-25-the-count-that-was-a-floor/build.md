# BUILD

### `DoorLog` — six sites, the rep's core loop

- **write-path:** the three unaccented KPI tiles `border-white/10 bg-white/[0.03]` →
  `border-default bg-surface`; the door glyph's ring, same; "No Answer" `bg-white/[0.04]
  border-white/12` → `bg-surface border-default`; the outcome screen's button, same; the Stop pill
  `bg-white/[0.06] border-white/15` → `bg-surface border-default`; a tap state `active:bg-white/5`
  → `active:bg-surface-raised`.
- **read-path:** `door-log` and a new `door-log-recording`, both themes.

**The last one was replaced by PATTERN, not by string** — `re.sub(r"rounded-full
bg-white/\[0\.06\] border border-white/15", …)` — which is the lesson from `TeamTrainingBriefPanel`
two commits ago applied the same hour it was learned.

What the idle screen looked like before, and what I had called clean this morning:

- **Three of the four KPI tiles had no tile.** KNOCKED 37, GO-BACKS 0 and NOT INT. 0 were bare
  numbers; only SOLD 2 — the accented one — had a card. The presence of the fourth is what made the
  other three read as intentional.
- **The door glyph had no ring.**
- **"No Answer" was a barely-there white box** beside a solid ember Record Pitch. It is one of the
  two things a rep taps at every door.

### The capture now drives more than one state

- **write-path:** `doorLog.capture.tsx` gains a `recording` capture, entered by clicking the
  component's own Record Pitch button rather than by poking state.

**And the mock was lying.** `start: vi.fn()` returns `undefined`; `recordPitch` at DoorLog.tsx:371
checks the return and refuses to enter a recording screen when it is falsy — deliberately, so a
mic-denied rep never sees a fake capture that records nothing. My mock made every click a
mic-denial.

The file's own comment, two lines above, warns about exactly this for `arm`: *"a vi.fn() returning
undefined throws on `.then`, which is the mock lying about the contract rather than the code
failing."* I wrote that comment this morning and then did the same thing to `start`.

`stop`'s shape was read from `useDoorRecorder.ts:318` rather than guessed.

### The sweep itself

Render-tree resolution + pattern matching + comment stripping, run against all 23 Sales Coach
routes. **80 unfixed sites across 20 files**, of which 6 are now closed.

```
$ npm run visual -- doorLog → 2 passed, 4 images
$ npm run check             → see closure
```
