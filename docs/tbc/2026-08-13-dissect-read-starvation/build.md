# BUILD — dissect "Your read" starvation on large prompts

## Feature inventory
### The dissect (and every deepseek engine) gets enough token budget for a large-corpus prompt
- write-path: none (LLM budget + logging + display copy). N/A.
- read-path: `withReasoningHeadroom(maxTokens)` now returns `min(maxTokens + 7000, 8000)` — the raised headroom
  (3500→7000) covers a prompt ~2.6× the calibration, and the clamp bounds the total under the 8192 model limit so
  no engine can 400. The dissect thus gets ~6900 reasoning room + its answer, so a large first-client corpus no
  longer starves the read to empty. Locked by the deepseek provider tests (7, incl. the new clamp test).
- diagnostic: the deepseek "length"-finish log now fires on EMPTY **and** TRUNCATED answers and prints
  prompt_tokens + completion_tokens + budget — so an insufficient budget is precisely visible next time.
- §3.4 copy: the after-pitch fallback no longer asserts "This was a short exchange" for a real call.

## Files changed
- src/lib/llm/deepseek.ts — REASONING_HEADROOM_TOKENS 3500→7000; MAX_TOTAL_TOKENS=8000 clamp; log EMPTY+TRUNCATED.
- src/lib/llm/__tests__/deepseek.provider.test.ts — clamp test (total ≤ 8000 ≤ 8192; small budgets keep headroom).
- src/lib/claude.ts — update the dissectCoachV5 budget comment (4600 → clamped 8000).
- src/app/dashboard/sales-coach/[id]/after-pitch/page.tsx — honest fallback copy (no false "short exchange").

## Holistic (§1.5.1)
The headroom + clamp apply to EVERY deepseek engine; the clamp keeps them all ≤ 8000 (safe under 8192), and the
tiny live engines are far below it (unaffected). No schema/behaviour change beyond the token budget + copy + log.
