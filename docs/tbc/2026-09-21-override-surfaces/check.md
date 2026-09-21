# CHECK

## Commands run, by the project's own names

```
 Test Files  669 passed | 1 skipped (670)
      Tests  4762 passed | 15 skipped (4777)
VITEST_EXIT=0
```

| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | clean |
| the two component suites | 39 + 25 passed, exit 0 |

## The tests were made to earn their place

17 mutations across the two components. Each defect was re-introduced into the source and the
suite re-run.

**The rep's correction row** (`PitchDetail`, 9):

| Mutation | |
|---|---|
| gate the section on the rep having disputed | CAUGHT |
| drop the reason block | CAUGHT |
| always use the plural heading | CAUGHT |
| blank instead of "Not scored" | CAUGHT |
| raw stored value instead of the shared label | CAUGHT |
| drop "already includes these" | CAUGHT |
| remove the screen-reader direction | CAUGHT |
| hard-code the grade label | CAUGHT *(after F2)* |
| remove the `?? []` rollout guard | CAUGHT |

**The manager's control** (`DisputeQueue`, 8):

| Mutation | |
|---|---|
| report a landed correction as a failure | CAUGHT |
| reply even when the correction failed | CAUGHT |
| send a blank reason | CAUGHT |
| derive the kind from the id prefix instead of the rubric | CAUGHT |
| allow correcting with no note | CAUGHT |
| always send `itemType: "element"` | CAUGHT *(after F3)* |
| offer the control on a whole-score dispute | CAUGHT |
| drop the note-becomes-reason warning | CAUGHT |

## Findings

### F1 — the correction row crashed the whole pitch panel on a payload without overrides

class: a TypeScript type used as a runtime guarantee across a JSON boundary. `PitchScorePanel`
  obtains the pitch via `await res.json() as StoredPitch` — a cast, which asserts a shape rather
  than checking one. `pitch.overrides.length` therefore threw for any payload from a server that
  predates the field.
severity: high. It does not degrade the new section, it **blanks the entire pitch panel** — score,
  bands, sections, disputes — because a section with nothing to show could not show nothing. The
  window is every rollout: a browser on new code served by an old server. Found by six unrelated
  tests failing, not by looking at the new code.
sweep: `grep -rn "as StoredPitch\|as .*Row\[\]" src/components/` — every `as` on a `res.json()`
  result is a place a missing field becomes a render-time throw rather than a type error.
fix: `(pitch.overrides ?? [])` at all three access points, plus a test whose fixture has the field
  **deleted** rather than set empty — mutation-confirmed to fail without the guard.

### F2 — the grade-label test pinned one grade out of three

class: an assertion that samples where it should enumerate. The test checked that `hit` rendered
  as "Hit" and stopped, so a component printing "Hit" for all three grades passed. Found by a
  surviving mutation, not by reading.
severity: medium. A "Missed" correction reading as "Hit" tells a rep their score went up when it
  went down — on the one screen built to explain a number.
sweep: any test asserting one member of a closed set. Here: `hit | partial | missed`, and
  `awarded | removed`.
fix: all three grades asserted in one render.

### F3 — no test ever sent a bonus correction

class: a fixture monoculture. Every correction test used the element fixture, so `itemType` was
  fixed at `"element"` throughout and a component hard-coding it passed.
severity: medium. The route refuses the mismatch (`unknown_item`), so it fails loudly rather than
  corrupting a score — but it would fail for **every bonus dispute**, which is the override the
  rubric actually specifies on page 7.
sweep: `grep -n "itemId:" src/components/sales-coach/__tests__/DisputeQueue.render.test.tsx` — a
  suite where every case shares one id shape cannot see a hard-coded kind.
fix: a bonus case asserting `itemType: "bonus"` reaches the route.

### F4 — a constraint I invented was sitting in the tree looking ratified

class: a rule with an argument instead of a source. `DisputeQueue.tsx` opened with *"WHAT IT
  DELIBERATELY CANNOT DO: change a score"* — written by me that morning from first principles, in
  the same voice as the constraints that come from the rubric or the constitution. The rubric
  (p.7) and the founder's decision both say the opposite.
severity: medium. Nothing broke, and that is the problem: an invented constraint is harder to spot
  than a duplicated one because nothing disagrees with it. Had the founder not chosen explicitly,
  the prohibition would have quietly defined the product.
sweep: `grep -rn "DELIBERATELY\|CANNOT\|MUST NOT\|never" src/components/ src/lib/` and ask of each:
  does it name a source, or make an argument? *"Rubric p.7"* is a source. *"If replying could
  adjust points…"* is an argument. In a docblock they read identically.
fix: kept as a SUPERSEDED CONSTRAINT in the file with its reasoning, and recorded in full as
  section K of `LOGIC-AND-CONTRADICTIONS.md` — noted, not silently applied, per the founder's
  standing instruction on this workstream.

## What is NOT verified

- **Nothing has been rendered in a browser.** Both components are covered by jsdom render tests;
  no human has looked at either surface. The select, the button and the amber partial-failure line
  have never been seen at any width.
- **No end-to-end path has been exercised.** The manager's click is tested against a mocked
  `fetch`; no run has gone from a real dispute through the real route to a real row and back onto
  a rep's screen.
- **The partial-failure state has never happened for real.** It is reasoned, tested against a
  mock, and unobserved.
- **`migration:audit` was not re-run for this build** — it touches no migrations. The previous
  build's in-session run stands: 254 applied, 0 failed, exit 0.
