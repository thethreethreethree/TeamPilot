# CHECK — Door Log: capture loss never drops the outcome + "Not Home"

## Gate — the canonical command (A38)

```
$ npm run check
 Test Files  549 passed | 1 skipped (550)
      Tests  3624 passed | 15 skipped (3639)
EXIT: 0
```

All gates exit 0 (typecheck, lint, theme:audit, tests, tbc). Client + pure-state-machine change; no
sales-scoring or server-route change.

## Findings
**No findings.** The two changes are traced to a single cause each (audio-less pitch 400; forced false outcome
at Stop) and fixed at the right layer (log a knock; add a legal transition). New render test locks the
capture-loss behavior so the "didn't save on our end" regression can't return silently.
