# CHECK — After-Pitch failure diagnosis

## Verification run (A38)
Canonical command: `npm run check`. Full-gate output + exit code in closure.md.

## Findings

### F1 — a generation failure shows a raw "HTTP 504", not the cause
file+line: `src/app/dashboard/sales-coach/[id]/after-pitch/page.tsx` `generate()` error paths (was
`Couldn't build the summary (HTTP ${res.status})`).
class: honesty / diagnostic-visibility (a raw HTTP code is not a cause; the rep can't tell a timeout from a
transcription outage from a private read).
severity: medium (the founder hit a 504 and it read as an opaque code; trust-relevant on the failure path).
sweep-command: `grep -n "explainAfterPitchError\|genError" src/app/dashboard/sales-coach/[id]/after-pitch/page.tsx`
— the error branch now renders the mapped cause.
read-path: fixed — 504/408/timeout → "That took too long to build — your recording is safe"; 502/503, 403, 429,
generic each named.

### F2 — an empty (two-sided) read shows a blank "Your read" with no reason
file+line: same page — the read view rendered a blank Narrative with no diagnosis when the write-up came back
empty on a two-sided call (no capture gap → BlankReadRecovery stays silent).
class: honesty / error-dressed-as-no-data (a blank read with no cause reads as "nothing happened").
severity: low-medium (transient — the read auto-heals — but confusing while blank).
sweep-command: `grep -n "EmptyReadBanner\|diagnoseAfterPitchRead" src/app/dashboard/sales-coach/[id]/after-pitch/page.tsx`
— the empty-read is now named at the top of the read.
read-path: fixed — EmptyReadBanner names it; one-sided is left to BlankReadRecovery (no duplication).

### F3 — the rep-blocking generation routes 504 on a long call (maxDuration too low)
file+line: `.../after-pitch/route.ts`, `.../review/route.ts`, `.../finalize/route.ts` (each `maxDuration = 60`).
class: deployment-config / timeout (an LLM generation over a long transcript exceeds the function budget → the
platform kills it → 504; the orthogonal maxDuration lens).
severity: high (a RECURRING 504 the founder hit — blocks feedback on real, longer calls).
sweep-command: `grep -rn "export const maxDuration" src/app/api/coach/sales-session/{[id]/after-pitch,review,[id]/finalize}/route.ts`
— all three now 300 (the Pro max, matching the STT routes).
read-path: fixed — the three generation routes a rep waits on now have a 300s budget; a slow-but-completing
generation no longer 504s.

## Class sweep (A26)
Swept the After-Pitch failure states: generation error (504/502/403/429/generic) — now named; empty-read — now
named; one-sided (customer-missing) — already named by BlankReadRecovery (verified, left as-is); fully-blank
(no audio / transcription never connected) — already named by the blank-read card (left as-is). Every failure
state now states its cause.

## Tests
```
$ npx vitest run afterPitchDiagnosis
 Test Files  1 passed (1)
 Tests  10 passed (10)
```
Locks the error-cause mapping (504 → took too long) + the empty-read-vs-one-sided classification. Full gate +
exit code in closure.md.
