# CHECK

## Commands run, by the project's own names

```
 Test Files  672 passed | 1 skipped (673)
      Tests  4821 passed | 15 skipped (4836)
CHECK_EXIT=0
```

```
  Missing policies:      0
  Violations:            0
  Unreachable modules:   0
  Not re-runnable (known): 0
  Not re-runnable (NEW):   0
EXIT=0
```

| Command | Result |
|---|---|
| `npm run check` | exit 0, with Postgres reachable |
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | clean |
| `npm run theme:audit` | 0 theme-bound leaks |
| the three new suites | 15 + 15 + 29 passed |

## The tests were made to earn their place

30 mutations across the three units. Every defect was re-introduced into the source and the suite
re-run. **0 survivors.**

**The board** (`leaderboard.ts`, 9): rank without sorting · rank by average instead of total ·
local dense ranking instead of the authority · positional rank ignoring ties · pool unattributable
pitches under a blank rep · prize threshold off by one · count every pitch rather than qualifying
ones · `standingOf` returns a zero row instead of null · hide ineligible reps. All CAUGHT.

**The route** (10): drop the company filter · give a rep the full board · read unscoped when no
company resolves · allow an anonymous caller · empty board instead of 500 on a failed read · name
lookup unscoped by company · name lookup not limited to the board · 500 when the name lookup fails
· rate limit after the read · manager company re-resolved instead of consumed. All CAUGHT.

**The surface** (11): failed read renders as an empty board · show the field to a rep by inferring
from rows · drop the prize warning · no standing renders as last place · naive ordinal · print the
uuid when a name is missing · hide counted-vs-handed-in · drop the rule from the screen · fold
skipped pitches in silently · period marked by colour only · open on all time. All CAUGHT.

The two worth naming are **rank without sorting** and **drop the company filter**. Neither throws,
neither empties a result, and both produce a board that looks exactly like a board.

## no findings

Nothing was discovered that needed fixing after it was built. Two things were caught *while*
building and are recorded in build.md rather than as findings, because neither ever reached a
committed state: `AggregablePitch` had no `repId` (the board was unbuildable on that type), and the
first draft of the route passed no `companyId` to a service-role read — which a typecheck caught
only because the argument was added in the same change.

## What is NOT verified

- **Nothing has been rendered in a browser.** Every claim about what a manager or rep sees is a
  claim about a jsdom tree. Two boards now sit on one page and nobody has looked at that page.
- **No end-to-end run.** The route is tested against a mocked `readPitchPeriod`; no query has gone
  to a real `pitch_scores` table and back onto a board.
- **The 900-row bound is untested against a real team.** `readPitchPeriod` caps at 900, so a
  company that recorded more than 900 pitches in a period would be ranked on a truncated set. The
  cap exists because PostgREST tops out at 1000; nothing warns when it bites.
- **`skippedPreVerdict` is reported but not attributed.** The board says four older pitches were
  left out; it does not say whose. A rep whose four pre-verdict pitches were dropped sees a lower
  total with no per-rep explanation.
