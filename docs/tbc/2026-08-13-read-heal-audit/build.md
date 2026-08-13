# BUILD — read-starvation fix audit remediation

### After-pitch read auto-heal keyed on the narrative (not the composite)
read-path: `src/app/dashboard/sales-coach/[id]/after-pitch/page.tsx` loads the stored summary
(`existing`) and, in the mount effect, decides whether to (re-)generate. It now calls
`afterPitchNeedsHeal(existing)` (`src/lib/coach/v5/afterPitchHeal.ts`) instead of the inline
composite-only check. `afterPitchNeedsHeal` reads `existing.hasSignal` AND `existing.narrative.hasSignal`.
write-path: when the predicate is true and the once-per-mount ref hasn't fired for this id, the effect
sets `autoGenAttemptedFor.current = id` and calls `generate()`, which POSTs to the after-pitch route;
the route re-runs `generateAfterPitchSummary` (against the fixed 7000-token headroom) and stores the
regenerated summary. A blank narrative masked by deterministic scores now re-generates on next view; a
healthy narrative (narrative.hasSignal true) is stored and no longer re-heals.

### DeepSeek stream-path starvation visibility
read-path: `src/lib/llm/deepseek.ts` `parseSseDeltas` reads the SSE `choices[0].finish_reason` per
event (previously typed but discarded) and tracks whether any content delta was seen.
write-path: at end-of-stream (`finally`), when `finish_reason === "length"` it emits a loud
`console.error` naming EMPTY vs TRUNCATED, the model, and the budget — mirroring the non-stream `call`
path. The stream `stream()` method passes `{ model, budget: withReasoningHeadroom(args.maxTokens) }`.
No content delta is swallowed (every `delta.content` still yields).
