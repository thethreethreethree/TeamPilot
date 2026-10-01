# CHECK - Pitch Performance leaves the website's nav

## Commands

```
$ npx vitest run src/lib/coach/doorlog src/components/sales-coach src/app/dashboard/sales-coach
      Tests  630 passed (630)
exit 0

$ (mutation: Pitch Performance put back into MACRO_MOBILE_TABS, salesCoachShellNav re-run, restored)
      Tests  1 failed | 21 passed (22)
exit 1

$ npm run visual -- doorLog ; npm run visual -- macroToggleLinks
  artifacts/visual/door-log.{light,dark}.png, macro-toggle-links.{light,dark}.png
exit 0
```

Opened, one at a time:

- door-log.light.png: four tiles (37 KNOCKED, 2 SOLD amber, 0 GO-BACKS, 0 NOT INT.), a round door icon,
  "Ready for the next door", the new amber link "See how your pitches went", then No Answer and Record Pitch.
- door-log.dark.png: the same on near-black; the link in bright yellow, readable.
- macro-toggle-links.light.png: white card, "Macro Mode", "This mode is for short form sales, under 15
  minutes. Fiber internet, Pest Control.", yellow toggle on, two tiles Door Log (yellow) and Today's Metrics.
- macro-toggle-links.dark.png: dark grey card, white heading, grey sentence, the same two tiles.

The full `npm run check` is appended below.

## Findings

### Removing the nav entries would have stranded the page

class: a page whose only standing entry points are the ones being removed
sweep: grep -rn "doors/report-card" src --include=*.tsx - list every link before removing one
severity: medium

### The website's Macro explanation predated REV 1

class: founder copy applied to one product and not the other
sweep: grep -rn "macro-mode-copy\|macroModeCopy" in both repos - the two must hold the same strings
severity: low

## Not opened

The capture PNGs other than the four listed above were not opened; none of them changed in this build.

## Appended — the full gate (against postgres:16-alpine)

```
$ MIGRATION_AUDIT_PSQL="docker exec -i pgprobe psql -U postgres" PGHOST=localhost PGPORT=55433 npm run check
  RLS probes:              1 run, 0 failed
✓ 3 claim(s) checked against real Postgres.
      Tests  5597 passed | 15 skipped (5612)
CHECK_EXIT=0
```
