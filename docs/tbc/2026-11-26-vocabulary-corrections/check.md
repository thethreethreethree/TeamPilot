# CHECK - Known mis-hearings in the transcription vocabulary

## Commands

```
node replay0354.mjs → default corrections [] ; stored [{"term":"Spectrum","heard":["spec trum"]}] ; non-array REFUSED
npx vitest run vocabulary VocabularySettings → 16 passed (parse, refuse double-claim, whole words, longest first; UI round-trip and parse error)
npx vitest run appendTranscriptSegment.corrections → 2 passed (term stored; failed lookup stores as heard)
npx vitest run settings → 17 passed; invariant-audit → 0 violations; tsc → clean
```

## Findings

### F1 - a vocabulary read per line would slow live calls
class: a hot-path read.
sweep: both writers share one per-session cache.
severity: low

### F2 - GET and PUT would break on a table without the new column
class: migration coupling.
sweep: GET selects *; PUT sends corrections only when present.
severity: low
