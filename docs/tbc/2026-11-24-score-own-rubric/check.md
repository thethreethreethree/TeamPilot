# CHECK - A score is corrected and read under its own rubric

## Commands

```
node remoteOverrides.mjs (production, counts only) → pitch_scores by rubric: attfiber-v1 52 · overrides on remote scores: 0
npx tsx labels.mts → 8 remote-only ids, 5 door-only ids, 0 shared ids with different labels
npx vitest run applyOverride.test.ts → 20 passed; same tests on the old applyOverride (git show HEAD) → 2 failed (the new cases) → restored
npx vitest run src/lib/coach src/components/sales-coach src/app/api/coach/sales-session/pitch-score → 3006 passed
```

## Findings

### F1 - correcting a phone/video score recomputed it under the door rubric
class: a default authority (the door rubric) standing in for the stored score's own.
sweep: all 18 importers of pitchScore/rubric — arithmetic: applyOverride, override route; labels: readPitchScore,
keyMoments, readPatterns, DisputeQueue; validation: search.ts; door-by-design: runDetection (patterns).
severity: high (latent; 0 affected rows today)

### F2 - Search refused the phone-only items its own page offers
class: same.
sweep: as F1.
severity: medium (live)

## Final

```
npm run check → first: ✗ tbc:manifest (§1.5.1 missing from the minimum set — read and added) → exit 0 · Test Files 914 passed | 1 skipped · Tests 6721 passed | 15 skipped
```
