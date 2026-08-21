# CHECK — Speaker balance in the Dissect

## Gate — the canonical command (A38)

```
$ npm run check
 Test Files  547 passed | 1 skipped (548)
      Tests  3606 passed | 15 skipped (3621)
EXIT: 0
```

All six gates exit 0. New pure util + 4 tests + integration; no sales/server change.

## Findings
**No findings.** The pure `computeSpeakerBalance` is tested (null-below-2, word-not-turn, dominance-threshold,
dominant-speaker naming). Honest boundary: whether the batch diarization's speaker labels are ACCURATE is an
ElevenLabs concern (device/integration-confirmed, same as the dissect route's transcription); the balance MATH
over whatever labels arrive is unit-tested.
