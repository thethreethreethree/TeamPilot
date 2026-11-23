# CHECK - Lock-screen and car controls for recorded calls

## Commands

```
npx vitest run useCallMediaSession.test.ts + sales-coach render suites → 471 passed (±15 s clamped to the recording, seekto clamped, play/pause)
```

## Findings

No findings: a standard browser API wired to existing players; not verifiable here on a real car or lock screen (stated in the closure).

## Final

```
npm run check → exit 0 · Test Files 904 passed | 1 skipped · Tests 6676 passed | 15 skipped (slow run on a loaded machine; finished in the background)
```
