# REMEDIATE — F1 dissect read starvation

## F1 — reasoning starved the dissect answer on a large prompt
Root cause: the deepseek reasoning model emits reasoning tokens (which count against max_tokens) before the
answer; on a prompt larger than the ~9k-token calibration (a first-client's bigger custom corpus + product
knowledge + full transcript), reasoning scaled past the 3500 headroom → the answer budget was starved → empty
content → no dissect strengths → `!hasSignal` → the after-pitch short-call fallback. The page's auto-heal retry
already re-ran it and still got empty → persistent, confirming starvation over a transient blip.

Remediation:
1. `REASONING_HEADROOM_TOKENS` 3500 → 7000 (covers ~2.6× the calibration). It stays a CEILING — costs nothing on
   calls that finish naturally.
2. `MAX_TOTAL_TOKENS = 8000` clamp in `withReasoningHeadroom`: the raised headroom + a large answer budget would
   otherwise exceed the 8192 model output limit and 400 EVERY deepseek call (no Anthropic failover in prod). The
   clamp bounds the total to 8000 — safe under 8192, above the confirmed-working 5000. Locked by a unit test.
3. Diagnostic: the deepseek "length"-finish log fires on EMPTY and TRUNCATED answers with prompt_tokens +
   completion_tokens + budget — so if 7000 is still short for an extreme corpus, the next log says exactly how much
   reasoning the prompt needs (and the fix then is corpus trimming, since 8192 is the model hard ceiling).
4. §3.4: the after-pitch fallback copy no longer falsely asserts "short exchange" for a real call.

Boundary (A26): the token change applies to every deepseek engine; the clamp keeps them all ≤ 8000 and the tiny
live engines are unaffected. The live LLM call is un-CI-testable — the clamp + model-limit reasoning + the log are
the safeguards.

Outcome: fixed (high confidence, log-confirmable). class: reasoning-model token starvation. severity: high.
