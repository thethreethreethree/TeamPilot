# Website vs app parity

The app hand-copies modules from the website (17 files say so in their own headers; the mobile plan counted
25 by a broader search). Each copy can drift silently. A **parity run** loads both versions, gives them the
same inputs, and counts where they disagree. It is Phase 3 step 1 of `docs/MOBILE-UNIFIED-PIPELINE-PLAN.md`,
and it changes nothing in either product.

```
APP_SRC=<path to Elostate-Sales-coach/src> node docs/mobile-parity/web-vs-app.parity.mjs
```

Run from the website repo root. It reads production transcripts in a read-only transaction and prints counts.

## Run 1 — 2026-10-01

| Compared | Website | App | Inputs | Result |
|---|---|---|---|---|
| Score dimension order | `lib/coach/doorlog/scoreLabels.ts` | `lib/doors/metrics-view.ts` | the constant | same |
| Score labels | same | same | 5 labels | **1 differed**: "Talk / Listen" vs "Talk / listen" |
| Judged dimensions | `lib/coach/gamification/calibration.ts` | `lib/gamification/calibration.ts` | the constant | same |
| Calibration threshold | same | same | 1.5 vs 1.5 | same |
| Trust verdict at the boundary | `<= threshold` | `dimensionTrustworthy` | 8 means around 1.5 | same |
| Whole-company roles | `lib/roles.ts` ADMIN_ROLES | `lib/kpi-scope.ts` | the constant | same |
| Pitch range | `lib/coach/v5/pitchSeparation.ts` | `lib/voice/pitch.ts` | MIN_F0 / MAX_F0 | same |
| Pitch detection (`detectF0`) | same | same | 896 synthetic voices, 60-450 Hz, 2 sample rates, 4 loudness levels, with and without noise | same, all 896 |
| Speech presence | `lib/coach/doorlog/speechPresence.ts` | `lib/audio/speech-presence.ts` | 104 production pitch transcripts, 1,456 production rep lines, 16 edge cases | same, all 1,576 |

The one difference had no recorded reason; the app now uses the website's "Talk / Listen" (app commit
`e6665290`, pinned by a test). Re-run after the fix: 9 comparisons, 0 differences.

Not yet compared: the screens that copy layout (`kpi.tsx`, `coach.tsx`, `scoreboard.tsx`, `arena-page.tsx`),
the chat helpers (`topic-decision`, `topic-filter`), crash reporting, the home menu, the arena and milestone
logic, and `types/backend.ts` (that last one is Phase 2's job: shared types, not a parity run).
