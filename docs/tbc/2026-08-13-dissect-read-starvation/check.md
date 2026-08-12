# CHECK — dissect read starvation

## Verification run (A38)
Canonical command: `npm run check`.

## Findings
### F1 — the after-pitch "Your read" is empty on a real call (reasoning-model token starvation on a large prompt)
file+line: `src/lib/llm/deepseek.ts` (REASONING_HEADROOM_TOKENS was 3500) → the dissect answer budget is starved
by reasoning on a prompt larger than the ~9k calibration; surfaces as `!narrative.hasSignal` →
`after-pitch/page.tsx` short-call fallback.
class: reasoning-model token starvation (the recorded reference_reasoning_model_token_starvation class), recurring
on a first-client's larger custom corpus.
severity: high (the first client's core deliverable — the coaching read — is blank).
sweep-command: `grep -rn "withReasoningHeadroom\|REASONING_HEADROOM" src/lib` — the headroom is applied at the
single provider chokepoint (`withReasoningHeadroom`), so raising it (clamped) covers EVERY deepseek engine, not
just the dissect; the other engines route through the same function.
remediation: raise the headroom to 7000, clamp the total to 8000 (see remediate.md).

## Tests
```
$ npx vitest run src/lib/llm/__tests__/deepseek.provider.test.ts
 Test Files  1 passed (1)
      Tests  7 passed (7)
```
The new clamp test locks the safety property: total = `min(answer+7000, 8000)` ≤ 8000 ≤ 8192, so no engine can 400;
small live budgets (16/160) stay below the clamp and keep the full headroom. The 2620-reasoning floor test still
holds. The actual live LLM call is not exercisable in CI (A30) — the clamp + the model-limit reasoning is the
guard, and the enhanced deepseek log surfaces any residual insufficiency (or a wrong clamp) immediately.

## Full gate
```
PENDING — pasted in closure after the run
```
