# CHECK — Empty/silent pitch audio fails honestly (H1)

## Gate — the canonical command (A38)

```
$ npm run check
 Test Files  553 passed | 1 skipped (554)
      Tests  3639 passed | 15 skipped (3654)
EXIT: 0
```

All gates exit 0. Worker-only change; no client/route/schema change.

## Findings
**No findings.** Three unit tests exercise the guards directly (empty STT, 0-byte audio, pre-persisted empty
transcript) and assert the pitch fails honestly and is NEVER analyzed or written 'complete'. The existing F4
skip-transcribe and double-processing-prevention tests still pass (no regression).
