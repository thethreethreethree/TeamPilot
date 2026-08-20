# Check — the canonical command + the visual verification

## Findings
No findings. The load-bearing risk for THIS build was visual (the exact class that shipped wrong
last time), so the verification is the rendered-PNG read below, not just a passing gate. The one open item is a
precondition, not a defect: migration 0234 must be applied for the custom-name WRITE (§1.5.3/A41) — recorded in
closure.md residual #1.


## Canonical verification command (A38 — the project's gate, run by name, not a self-scoped subset)
```
npm run check
```
= `typecheck && lint && theme:audit && rls:audit && invariant:audit && test` + the tbc stages. Exit 0 is the
bar. `npx tsc --noEmit` → 0; `npx vitest run src/lib/schedule/__tests__/shiftColors.test.ts` → 6/6 pass.

## The verification the FAILURE demanded (A42 / §1.5.4)
The defect was a visual one reported "done" without being seen. So the load-bearing check is not "it renders" —
it is **looking at what it renders**. A standalone repro of the exact `renderCanvas` logic (same band palette,
same layout math) was fed sample data mirroring the founder's staff×date schedule, rendered headless
(Chrome `--screenshot`), and the PNG was READ:
- Brand header band with "WORK SCHEDULE" eyebrow + the custom title + generated date/span. ✓
- Colour legend: Morning (amber) · Daytime (blue) · Evening (violet) · Overnight (indigo) · Time off (rose). ✓
- Colour-coded pills: 06:00-15:00 amber, 13:00-22:00 blue, 21:00-06:00 indigo, time-off "· off" in rose. ✓
- Weekend (Sat/Sun) columns tinted; weekday labels orange; week accent bars; zebra name column. ✓

"It reads at a glance" — the thing the founder asked for — is confirmed by eye, not asserted from "the code ran".

## Not verified here (honest)
- The custom-name WRITE against the live DB: migration 0234 could not be applied from this environment
  (`db:apply` → "COULD NOT CONNECT: timeout"). Flagged as a founder precondition (§1.5.3/A41). The read path is
  correct pre-migration (guarded fallback → company name), so the export is unaffected until the name is set.
- The redesigned canvas inside the real running app (vs the faithful standalone repro): the drawing code is
  byte-identical; the repro is the honest proxy where a live authenticated session with data isn't reachable here.
