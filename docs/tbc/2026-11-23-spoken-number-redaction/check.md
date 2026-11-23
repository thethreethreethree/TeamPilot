# CHECK - Remove numbers read out in words

## Commands

```
node scratchpad/spoken.mjs (production, read-only, counts only) → lines with 2+ adjacent number words: 44 · lines with a run of 4+ number words: 0 · lines already carrying [number removed]: 0
first rule over every production line (scratchpad probe, counts only) → lines: 2963 · would change: 2 · largest word-runs: 32, 32
shape of the 2 (word kinds and step sizes only, no text) → kinds XUXU… (twenty-one, twenty-two, …) · steps 1,1,1,1,1,1,2,2,1,1,1,1,1,1,3 from 21 — someone counting
counting exception (one direction, steps 1–3) → same probe → lines: 2963 · would change: 0
npx vitest run redact.test.ts transcriptRedactionGate.test.ts → 11 passed
```

## Findings

### F1 - the first spoken-number rule would have removed someone counting
class: a pattern rule tuned on invented examples, wrong on real speech.
sweep: every production transcript line run through the rule before shipping; the 2 changed lines were both counts.
severity: medium (180 characters of ordinary speech lost per line)

## Final

```
npm run check → first: ✗ tbc:manifest (§3.3 reason too short) → given a real reason → exit 0 · Test Files 898 passed | 1 skipped · Tests 6631 passed | 15 skipped
```
