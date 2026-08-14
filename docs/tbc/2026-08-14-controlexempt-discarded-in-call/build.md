# BUILD — controlExempt must survive the call() gate re-check

### claude.ts `call()` — mirror runBrainCall's gate condition
read-path: `src/lib/claude.ts` `call()` (the shared wrapper for every non-streaming engine: debriefCoachV5,
dissectCoachV5, liveSalesCue, proposeDecisionDialogue, generateCareReply, spawnTask, generateDailyQuestions).
write-path: the post-call suppression re-check `if (!r.gate.guidanceEnabled)` → `if (!r.gate.guidanceEnabled
&& !args.controlExempt)` — exactly runBrainCall's own condition (brain/index.ts). With controlExempt the LLM
already ran and `r.text` holds the real answer; it now passes through instead of being discarded.

## Diagnostic (read-only, retrospective §1.2)
`scripts/diag-empty-reads.mjs` — service-role read over recent after_pitch_summaries, correlating empty
narrative with `ai_guidance_enabled` + corpus size. This is the artifact that overturned the starvation theory
and pinpointed the gate. Kept in-tree as the reusable retrospective (no writes).

## Test coverage
`src/lib/__tests__/claude.controlExempt.test.ts` (3):
1. guidance OFF + controlExempt → `suppressed:false` + REAL text (the bug: was discarded).
2. guidance OFF + NOT exempt → still `suppressed:true` (the §3.4 control window holds — no regression).
3. guidance ON → real text.
Detection: dropping `&& !args.controlExempt` makes test 1 fail (returns suppressed:true / text:"").

## Blast radius (§1.5)
One line at the chokepoint fixes: the After-Pitch "Your read" (debriefCoachV5), moments + cue-outcomes
(dissectCoachV5), LIVE cues (liveSalesCue — the "0 cues" sessions), decision-dialogue, and ask-coach — for
EVERY guidance-off company. Streaming (runBrainStream / extension suggest) was already correct and is untouched.
No company guidance flags were flipped — the fix restores the intended exemption, preserving the control
baseline for the non-exempt Elostate diagnostic system.
