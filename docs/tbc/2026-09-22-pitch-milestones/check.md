# CHECK

## Commands run, by the project's own names

```
 Test Files  676 passed | 1 skipped (677)
      Tests  4894 passed | 15 skipped (4909)

  Missing policies:      0
  Violations:            0
  Unreachable modules:   0
  Migrations applied:      255
  Not re-runnable (NEW):   0
CHECK_EXIT=0
```

| Command | Result |
|---|---|
| `npm run check` | exit 0, with Postgres reachable |
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | clean |
| the three new suites | 22 + 12 + 12 passed |

## The tests were made to earn their place

25 mutations across the three units. **All caught.**

**The derivation** (13): Clean sweep as "no violations" · Clean sweep accepting a partial · Clean
sweep needing only one section · Full bundle as "any three bonuses" · Full bundle counting a
rejected bonus · counting pitches that did not qualify · no sort before picking first/hundredth ·
Century off by one · Triple digits as a running total · Triple digits excluding exactly 100 · In
the door firing on any bonus — all CAUGHT.

**The route** (6): newest-first read · read the whole company rather than one rep · empty strip
instead of 500 · allow an anonymous caller · rate limit after the read · never report the cap —
all CAUGHT.

**The strip** (6): hide unearned badges · failed read as an empty strip · unearned state by colour
only · drop the captions · ignore the repId prop · show the year — all CAUGHT.

The one worth naming is **Clean sweep as "no violations"**. It is the definition I would have
written from the badge name, it passes a reader's eye, and the only thing that rules it out is the
sheet's own caption.

## Findings

### F1 — the two definitions I was about to invent were both wrong

class: a specification read from a summary instead of from the source. The two-systems map records
  the milestone NAMES ("First pitch · Triple digits · In the door · Full bundle · Clean sweep ·
  Century") and not their definitions. Building from that list would have meant inventing six
  meanings from six names.
severity: high, and it is a near-miss rather than a defect — nothing shipped. Extracting the PDF's
  text gave the real captions: Clean sweep is *"Every phase fully hit"*, not "no violations", and
  Full bundle is *"DTV + Wireless + ADT in one pitch"*, not "any three bonuses". Both of my
  readings were plausible, and both would have produced badges firing on the wrong pitches with no
  test able to notice.
sweep: `grep -rn "design shows\|the design has" "docs/SYSTEM UPDATES AND REVISION/"` — every place
  the map paraphrases the sheet rather than quoting it. The map is an index, not a substitute
  (§A22's shape, applied to a product spec rather than to the constitution).
fix: `pdftotext -layout` on the sheet, definitions taken from its captions, and each inferred
  definition marked as inferred in the module so the distinction survives.

### F2 — a test regex was silently corrupted into a control byte

class: an escape mangled in transit, producing a file that compiles and a test that cannot pass.
  `/\b12\b/` was written to disk as `/<0x08>12<0x08>/` — a literal backspace character. The failure
  message rendered it as `/12/`, so the reported expectation and the actual one differed, and
  "expected 'Aug 12' to match /12/" read as impossible.
severity: medium. It failed loudly, which is the good case; the bad case is the same mangling
  landing in a regex that still matches something, in source rather than in a test.
sweep: `grep -rlP '\x08' src/ scripts/ supabase/ docs/` — run repo-wide after this was found. Only
  `apple-icon.png` and `favicon.ico` match, both binary and expected. No source file is affected.
fix: the assertion is a plain `toContain("12")`, and the sweep is recorded here so the check is a
  command rather than a memory.

### F3 — a fixture generated dates that do not exist

class: a generated fixture that is wrong in a way the assertion cannot see. The Century test built
  100 dates as `2026-03-${i}` and produced `2026-03-50`. The string sort still ordered them, so the
  test would have passed for entirely the wrong reason had the expected value matched.
severity: medium. It failed here by luck — the expected date was the one real value in the set.
sweep: any fixture that interpolates a counter into a date string.
fix: real `Date.UTC` timestamps, with the reason written beside them.

### F4 — a guard that guarded nothing

class: defensive code that reads as protection and changes no behaviour. `isCleanSweep` filtered
  hit elements through `ELEMENTS_BY_ID.has(...)` before building its set — but the check below asks
  whether every CURRENT id is in that set, so an extra unknown id is unreachable by construction.
severity: low. Nothing was wrong; the line was dead. It survived a mutation, which is how it was
  found, and the convenient reading — "an equivalent mutant, move on" — was true and still worth
  acting on.
sweep: a surviving mutant on a filter or guard clause is a candidate for this, rather than
  automatically an equivalence.
fix: removed, with the reasoning in its place so the next reader does not add it back. The test was
  strengthened to cover both grades of a retired element rather than only the one that passes
  trivially.

## What is NOT verified

- **Nothing has been rendered in a browser.** Two milestone strips now sit on one page — the
  Arena's and this one — and whether a rep reads them as two systems or as one confused one is
  precisely the question jsdom cannot answer. This is the third build in a row to end on that
  sentence.
- **`tripleDigits` and `inTheDoor` are inferred**, not specified. If the sheet's intent differs,
  both are one constant away from correct, but nothing here would tell anyone they were wrong.
- **No end-to-end run.** No badge has been derived from a real `pitch_scores` row.
- **The 900 cap has never bitten.** `capped` is returned and no test exercises a real truncation
  against a database.
