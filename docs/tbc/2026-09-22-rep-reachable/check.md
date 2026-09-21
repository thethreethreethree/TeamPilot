# CHECK

## Commands run

```
      Tests  4945 passed | 15 skipped (4960)
  Violations:            0
  Unreachable modules:   0
CHECK_EXIT=0
```

| Command | Result |
|---|---|
| `npm run check` | exit 0, with Postgres reachable |
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | clean |
| `npm run reachability:audit` | 0 unreachable — after failing at 1 mid-build |

## The tests were made to earn their place

5 mutations. **All caught.**

| Mutation | |
|---|---|
| hard-coded 200% track (third pane clipped) | CAUGHT *(after F1)* |
| hard-coded 50% offset | CAUGHT |
| stale 50% pane width | CAUGHT *(after F1)* |
| Breakdown dropped from the pager | CAUGHT |
| Breakdown after Metrics, not the sheet's order | CAUGHT |

## Findings

### F1 — the pager's geometry was asserted by nothing

class: a layout invariant that jsdom cannot observe and no test had stated. The track width and the
  pane widths existed only as style strings, so a track left at 200% with three panes — which
  clips the last one entirely — passed every test. The page state, the tabs and the transform would
  all still be right.
severity: medium. It is exactly the defect this build could most easily have shipped: the change
  that adds a page is the change that invalidates the literals.
sweep: `grep -rn 'width: "[0-9]*%"' src/components/` — any layout literal that encodes a count.
fix: the geometry derives from `PAGES.length`, and a test asserts the track is `300%` and each pane
  is a third — read as numbers with a tolerance rather than as a string, since the browser's
  precision for `100/3` is not ours to predict.

### F2 — four pager tests encoded a two-page world

class: tests that describe the product rather than constrain it. One was named *"cannot advance
  past the ends (no third page)"*, and `pageOf` tested for `-50%` — which, on a three-pane track,
  reports page 0 for every page.
severity: medium. `pageOf` is the worst of the four: it would have silently passed every navigation
  assertion in the file.
sweep: any helper that decodes state from a literal that a count determines.
fix: `pageOf` parses the offset and divides by the pane width; the edge test walks all three panes;
  the keyboard test moves through Breakdown.

## Limits of this check

- **Nothing has been rendered in a browser.** Tenth consecutive build, and this one changed a
  swipe surface: the drag maths is exercised by synthetic touch events with no layout width, which
  is why `SNAP_MIN_PX` exists as a floor.
- **The swipe has never been performed.** Three panes on a real finger is untested by anything here.
- **`/my-progress` and the pager now render identically.** Whether a manager wants a swipe pager on
  a desktop route is a judgement nobody has looked at.
