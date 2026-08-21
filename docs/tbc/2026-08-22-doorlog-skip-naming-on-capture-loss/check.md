# CHECK — Door Log: skip naming when capture produced no audio

## Gate — the canonical command (A38)

```
$ npm run check
 Test Files  549 passed | 1 skipped (550)
      Tests  3624 passed | 15 skipped (3639)
EXIT: 0
```

All gates exit 0 (typecheck, lint, theme:audit, tests, tbc). Client-only Door Log change; no server,
state-machine, or sales change.

## Findings
**No findings.** The no-audio decision moves to where the fact is known (STOP); `save()`'s late upload-failure
fallback is retained; the render test now locks the skip-naming behavior so it can't regress into the phantom
naming step.
