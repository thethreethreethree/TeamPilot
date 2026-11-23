# CHECK - Refresh the AI notes after transcript corrections

## Commands

```
npx vitest run transcript-edit route + SessionTranscript.edit.render → 15 passed (rep with corrections: audited + re-run; no corrections: 409, nothing run; a stranger: 403; the button appears only with corrections and is sent once)
node scratchpad/tonly.mjs (production, read-only) → company_recording_settings rows 0, transcript_only 0 · max calls with audio in one day (90d): 6
```

## Findings

### F1 - a refresh endpoint could run paid AI calls repeatedly
class: a paid action behind a button.
sweep: the same rights as editing, at least one correction, audit row, 3 per 10 minutes per person.
severity: medium (cost)

## Final

```
npm run check → first: ✗ typecheck (test mock type lacked an optional count) → fixed → exit 0 · Test Files 900 passed | 1 skipped · Tests 6654 passed | 15 skipped
```
