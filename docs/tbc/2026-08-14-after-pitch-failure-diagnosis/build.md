# BUILD — After-Pitch failure diagnosis (exact cause on screen)

### explainAfterPitchError — a generation failure's exact cause
read-path: `src/lib/coach/v5/afterPitchDiagnosis.ts` `explainAfterPitchError(status, raw)` maps an HTTP failure
to a rep-facing `{title, detail}` (504/408/timeout → "took too long, recording safe"; 502/503 → transcription
unavailable; 403 → private; 429 → too many; else friendly generic).
write-path: none (pure). `src/app/dashboard/sales-coach/[id]/after-pitch/page.tsx` `generate()` sets a `genError`
from it; the render shows a new `genError` branch (title + detail + Try again) BEFORE the generic `error` branch.

### diagnoseAfterPitchRead + EmptyReadBanner — name the empty (two-sided) read
read-path: `diagnoseAfterPitchRead(summary)` returns the empty-read cause ONLY (null for a healthy read, and null
for a one-sided gap — BlankReadRecovery owns that). `EmptyReadBanner` renders it at the top of the read (both
Standard + Expert branches).
write-path: none (pure classification over existing state). Reuses the exported `SummaryLike` from captureGap.

## Test coverage
`src/lib/coach/v5/__tests__/afterPitchDiagnosis.test.ts` (10): explainAfterPitchError maps 504/408/timeout →
"took too long", 502/503 → transcription-unavailable (audio safe), 403 → private, 429 → too many, 500/unknown →
a friendly generic (never a raw code); diagnoseAfterPitchRead names empty-read, returns NULL for a one-sided gap
(no BlankReadRecovery duplication) and for a healthy read. The client wiring follows the repo convention (0
`*.test.tsx`).

### raise maxDuration on the rep-blocking generation routes (fix the recurring 504)
read-path: `src/app/api/coach/sales-session/[id]/after-pitch/route.ts`,
`src/app/api/coach/sales-session/review/route.ts`,
`src/app/api/coach/sales-session/[id]/finalize/route.ts` each export `maxDuration = 300` (was 60).
write-path: none (deployment config). Over a 5–10 minute call's transcript these LLM generations can run past
60s; Vercel was KILLING the function at the ceiling → the 504 the founder hit repeatedly. 300s is the Pro plan
max (the STT routes already use it).

## Notes
- `SummaryLike` exported from captureGap (was local) so the classifier reuses the exact shape detectCaptureGap
  validates.
- Diagnosed live: session "New session test 4" (10-min wall clock) had 0 audio, 0 transcript, AND 0 live cues —
  live coaching never recorded, so nothing was captured (not a save bug). The 504 is a separate, real timeout on
  the generation routes, fixed by the maxDuration raise.
- Follow-up (flagged): if a generation ever genuinely HANGS (vs runs-long), the durable fix is an LLM-call
  timeout that fails fast with a clear message — not more ceiling.
- The one-sided + fully-blank (no-audio / transcription-never-connected) states are UNCHANGED — already named by
  BlankReadRecovery + the page's blank-read card; this build only fills the silent states.
