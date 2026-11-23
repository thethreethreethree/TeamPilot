# CHECK - Correct who said a transcript line

## Commands

```
node scratchpad/replay0328.mjs (PGlite) → line 2 → customer: version 2 · repeat: no new version · "robot": refused · no such line: refused · v1 kept "agent" · edit row field "speaker" · a 0311 word correction still records "text" (local failures: 0315, 0327 — auth objects absent locally, known)
npx vitest run transcript-edit route + SessionTranscript.edit.render → 21 passed
npm run db:apply → applied 0328 · DB now at 0328 · ✅ ALL 33 invariants hold
```

## Findings

### F1 - a speaker-only change would not have marked the AI notes as older
class: a staleness check reading one kind of edit.
sweep: the check now uses the newest edit of any kind (latestEditAt) besides the word marks; tested.
severity: low

## Final

```
npm run check → exit 0 · Test Files 906 passed | 1 skipped · Tests 6688 passed | 15 skipped
```
