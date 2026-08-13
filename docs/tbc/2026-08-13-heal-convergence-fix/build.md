# BUILD — after-pitch heal convergence fix

### afterPitchNeedsHeal gates the narrative-heal on scores (agent-turns proxy)
read-path: `src/lib/coach/v5/afterPitchHeal.ts` `afterPitchNeedsHeal(existing)` now reads
`existing.hasSignal`, `existing.narrative.hasSignal`, AND `existing.scores.length`. Consumer unchanged:
`src/app/dashboard/sales-coach/[id]/after-pitch/page.tsx` passes the loaded summary (which carries `scores`),
so no call-site change was needed.
write-path: the narrative-heal clause returns true only when `!existing.narrative.hasSignal && existing.scores.length > 0`.
When true and the once-per-mount ref hasn't fired, the effect calls `generate()` → the after-pitch route
re-runs the assembler. A one-sided recording (scores empty) no longer triggers the heal, so the effect no
longer re-fires a non-converging 4-engine generation on every mount; a starved read (scores present) still
heals and converges under the 7000-token budget.
