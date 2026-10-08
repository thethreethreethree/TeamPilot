# CHECK - a failed read is not an unscored pitch

## Commands

```
$ npx tsc --noEmit -p .                                   exit 0
$ npx vitest run src/lib/coach/pitchScore src/app/api/coach/sales-session/pitch-score src/components/sales-coach
      Tests  923 passed (923)
$ npx vitest run src/app/api/coach/sales-session/pitch-score   Tests 168 passed
$ (mutation: the main read returns null on error again)   readPitchScore.test.ts   Tests 1 failed | 20 passed   (restored)
```

The full `npm run check` is appended below.

## Findings

### A failed pitch-score read was shown as "not scored", with a paid re-score offered

class: a reader returning the same value for "absent" and "could not read" (return-to-value, which INVARIANT 22's catch rule cannot see)
sweep: the 15 exported null-returning async functions in src/lib/coach, each read by hand (a scripted heuristic was tried first and found too loose to trust)
severity: medium

### The recording detail answers 404 for a read error

class: same
sweep: as above
severity: low

Deliberately indistinguishable from not-yours (RLS), and no paid action follows. Recorded, not changed.

## Not opened

No image, icon, logo, favicon or graphic asset was touched.

## Full gate

```
$ MIGRATION_AUDIT_PSQL=... PGPORT=55433 ... npm run check
 RLS probes: 3 run, 0 failed
 Test Files  734 passed | 1 skipped (735)
      Tests  5707 passed | 15 skipped (5722)
exit 0
```
