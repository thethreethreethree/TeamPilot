# CHECK — the design was the specification, and five parts of it were not built

## The canonical gate

```
$ PGUSER=… PGPASSWORD=… MIGRATION_AUDIT_PSQL="docker exec -i ics-postgres psql -U ics" \
  MIGRATION_AUDIT_MAINT_DB=ics npm run check
$ echo "CHECK_EXIT=$?"
CHECK_EXIT=0
```

## Seven new render tests, one per specified string

| Case | The defect it names |
|---|---|
| RECENT RECORDINGS + the all-time count | the header the design specifies, absent |
| **no count at all when the response carries none** | "0 all time" over a list with rows in it |
| "Showing the 1 most recent of 412" | a bound named without its set, and a hard-coded `100` |
| the score as `58.5 base +5.0 −2.0 = 61.5` | four numbers that never add up on screen |
| "click to jump" | rows clickable since they were built, with nothing saying so |
| the total handed upward, once | a tab label that cannot show `(7)` |
| no count reported when the response has none | a label claiming `(0)` from an older bundle |

## Mutation probes

| Mutant | Result |
|---|---|
| "all time" taken from `rows.length` | `heads the list with RECENT RECORDINGS and the all-time count` fails |
| the arithmetic reverted to a list of parts | `prints the score as arithmetic that adds up` fails |

One failure each, by name, with the other 21 unaffected.

## Lint caught a stale closure, and it was right

The first version kept a "have I notified" flag in React state and read it inside the effect.
`react-hooks/exhaustive-deps` flagged it, and the flag would indeed have been read at its value
from the previous render. Removed rather than added to the dependency array: the effect runs once
per `repId` and the fetch resolves once per run, so the case it guarded is unreachable — and a flag
guarding an unreachable case will be wrong about a reachable one later.

---

## Findings

### None of this verifies that the result LOOKS like the design

class: a test asserting the strings the same commit put on screen. It is a tautology one step
  removed — it pins that a change does not silently undo this work, and says nothing about whether
  the work matches the specification it came from.
severity: medium, and structural rather than fixable.
sweep: not applicable. There is no command that compares a rendered page to a PDF.

- Seven tests assert seven strings. Every one of them would pass if the layout were wrong, the
  colours were wrong, the header sat under the list instead of above it, or the arithmetic wrapped
  onto three lines at the width a manager actually uses.
- The design is a full-page PDF with a specific arrangement. What has been checked is its
  *wording*, which is the part a string can hold.
- **Twenty-fourth consecutive build shipped without a real render.** For most of them that was a
  gap; for this one it is nearly the whole point, because the subject IS the appearance.
- What would close it is a person with the PDF beside the screen. Not a test.

## What this run does not cover

- **The other six PDFs** in `docs/SYSTEM UPDATES AND REVISION 09-22-2026/` are unopened, so whether
  the surfaces THEY specify match what was built is unknown. One was checked because the founder
  asked about one.
- **The two buttons and the street address**, both deliberately unbuilt and both founder questions.
