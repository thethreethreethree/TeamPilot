# CHECK

## Commands

```
$ npx tsc --noEmit -p tsconfig.json
(no output)
exit 0
```

```
$ npm run visual -- pitchPerformance
      Tests  3 passed (3)
  6 image(s) in artifacts/visual/
exit 0
```

The first full-gate run on this build failed on this directory alone — `build.md`, `check.md` and
`closure.md` missing, because a heredoc broke on an apostrophe and wrote only `think.md`. Every
other step passed.

## It was looked at, before and after, in both themes

**Before, light** — `pitch-performance-failed.light.png`: a white bordered card, the message in
pale salmon, barely separable from the near-white fill. "Retry" below in bronze, legible.

**After, light** — the same card, the message in a strong saturated red, immediately readable.

**After, dark** — a dark bordered card, the message still in pale salmon, "Retry" in bright amber.
**Unchanged**, which is what the `dark:` variant is for.

**The populated state** — three white cards: "Maple Ct" with a green "Sold" pill, "Alder Row" with
"Go Back", "Birch Lane" with "Not Int." and an amber "processing…" plus the italic line "Summary
appears once processing finishes."

## Findings

### Error text in a dark-mode red on a theme-following surface

class: a colour chosen against matte black, used for text on a surface whose ground follows the theme
sweep: `grep -rn "text-red-300|text-red-400" src/components/sales-coach src/app/dashboard/sales-coach --include=*.tsx | grep -v "dark:text-red"`
severity: high

**[OBSERVED]** 12 matches; 10 are error text on theme-following surfaces and are fixed.

**[OBSERVED]** the report card's failed-read message renders at roughly 2:1 on cream. That is the
member that was rendered; the other nine share its shape and were read at their lines.

**[INFERRED]** the two Door Log states recorded as inferred at 05:45 are in this set and are now
fixed, though still not rendered — I could not reach those states, and the fix is class-level.

High rather than medium because of who reads these: a door-to-door rep, outdoors, in daylight —
which is when a person picks light mode — being told "the mic stopped — audio isn't recording".

### `outcome` names five different vocabularies

class: one field name carrying different value sets across tables, with nothing at the point of use saying which
sweep: `grep -rhnoE "create type [a-z_]+ as enum[^;]*|check \(outcome in \([^)]*\)" supabase/migrations/*.sql | grep -i outcome | sort -u`
severity: medium

**[OBSERVED]** five: `knock_outcome` (0215), sales sessions (0077), `pitch_scores` (0252), KPI
(0205), care learning engine (0036). Three contain the token `sold`.

**[OBSERVED]** every consumer checked today matches its own table's vocabulary. No defect.

**[OBSERVED]** it has caused four of my own errors in one session — three fixtures built from the
wrong enum, and one of those nearly reported as a product bug.

Same shape as `closeRate` carrying two units, found an hour earlier. Neither is wrong today; both
are traps whose cost is paid by the next reader.

## What this does not prove

**Two of the ten were never rendered.** The Door Log's send-failure banner and mic-stopped alert
are fixed by class, and I still have not reached those states — three attempts, documented at 05:45.

**The other four unrendered surfaces** — Roleplay, One Liners, Sessions and Analytics — have not
been swept for this class beyond the grep above.

### A label map duplicating a module built to end duplication

class: a local copy of a value that has a designated single source, made because the local case needs only a subset of it
sweep: `grep -rln "outcomeLabel" src --include=*.ts --include=*.tsx` against every local outcome-to-label map
severity: low

**[OBSERVED]** `outcomeLabels.ts` was created by audit F7 to replace four copies. `RecordingsTab`
carried a fifth with byte-identical strings for the three values it needed.

**[OBSERVED]** eight files import the shared module; one did not.

**[OBSERVED]** `PitchPerformance`'s map is NOT a copy — different vocabulary, different values,
plus styling. Verified by reading both rather than matching the variable name.

Low severity because nothing renders wrongly: the strings agree today. It is on the record because
the agreement is a coincidence maintained by hand, which is what F7 was written to stop.
