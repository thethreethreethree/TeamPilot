# BUILD — route the meeting dissect to the non-reasoning model

### Thread a per-call model override (only DeepSeek reads it)
- write-path: `src/lib/llm/types.ts` adds `model?` to LlmCallArgs; `src/lib/llm/deepseek.ts` honors
  `args.model ?? env ?? DEFAULT_MODEL` (both call sites) and exports `DEEPSEEK_NONREASONING_MODEL = "deepseek-chat"`;
  `src/lib/brain/index.ts` (runBrainCall) + `src/lib/claude.ts` (call + dissectCoachV5) forward `model`.
- read-path: a caller can pin a non-reasoning model for one call; every other caller is unchanged (model unset →
  the reasoning default). The §3.4 `suppressed` verdict is untouched — the override rides alongside it.

### The meeting dissect uses it
- write-path: `src/lib/coach/strategy/meeting/generateMeetingDissect.ts` passes `model: DEEPSEEK_NONREASONING_MODEL`
  to `dissectCoachV5`.
- read-path: a long meeting transcript now returns a real dissect (non-reasoning model answers directly) instead of
  the reasoning model's empty completion → the review generates.

## Files
- `src/lib/llm/types.ts`, `src/lib/llm/deepseek.ts`, `src/lib/brain/index.ts`, `src/lib/claude.ts`,
  `src/lib/coach/strategy/meeting/generateMeetingDissect.ts`
- `scripts/diag-fm-dissect-llm.mjs`, `scripts/diag-fm-dissect-fix.mjs`, `scripts/diag-fm-review-state.mjs`,
  `scripts/recover-fm-meeting-dissect.mjs` (forensic + the founder-content recovery)

## Ripple (§6 item 5)
- SALES dissect unaffected (leaves `model` unset → keeps `deepseek-v4-flash`); its shorter calls don't starve.
- Anthropic provider ignores `args.model` (uses ANTHROPIC_MODEL) → cascade safe; and Claude is non-reasoning
  anyway, so a fallback also produces the answer.
- No change to the control gate, prompts, or the parse — only which model the meeting extraction runs on.
- `withReasoningHeadroom(1100)=8000` still applied; harmless for the non-reasoning model (a ceiling it finishes
  well under).
