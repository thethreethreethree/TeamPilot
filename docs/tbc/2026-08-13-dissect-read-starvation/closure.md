# CLOSURE — dissect read starvation

## What shipped
The after-pitch "Your read" was going blank on real calls because the deepseek reasoning model starved the
dissect's answer budget on prompts larger than the ~9k-token calibration (a first-client's bigger custom corpus).
Fix: `REASONING_HEADROOM_TOKENS` 3500 → 7000, clamped to `MAX_TOTAL_TOKENS = 8000` so the raised budget can't
exceed the 8192 model limit and 400 every deepseek call. The deepseek "length"-finish log now covers truncated as
well as empty answers (with prompt/completion token counts), so any residual insufficiency is precisely visible.
The after-pitch fallback copy no longer falsely calls a 4–5 min call a "short exchange" (§3.4).

## Verification (A38) — real gate output
`npm run check` — full gate, exit 0:

```
$ npm run check
typecheck ✓ · lint ✓ · theme:audit ✓ (0 leaks) · rls:audit ✓ (0 without RLS)
invariant:audit ✓ — Files scanned 773 · Violations 0
tbc ✓ — docs · manifest · artifacts · residual · freshness — all ✓
test ✓ — Test Files 401 passed | 1 skipped (402); Tests 2766 passed | 15 skipped (2781)
EXITCODE=0
```
deepseek provider suite: 7 passed incl. the new clamp test (total ≤ 8000 ≤ 8192; small budgets keep full headroom).

## Residual (A36 — top OPENED)
```json
[
  { "id": "R1", "item": "If a rep's corpus is so large that reasoning needs > ~6900 tokens, even the 8000 clamp starves — and 8192 is the model hard ceiling, so more budget isn't possible.", "why_skipped": "8000 covers ~2.6× the calibration; a prompt beyond that is unusual, and the real remedy there is trimming the methodology/product corpus, not more budget. The enhanced log now reports the exact completion_tokens so this is diagnosable, not silent.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-13T13:20:00Z", "outcome": "Opened + assessed: bounded by the model ceiling; the log makes an over-large corpus visible so it can be trimmed. Not silently swallowed." },
  { "id": "R2", "item": "The live deepseek call (and thus that the 8000 clamp is truly ≤ the deployed model's limit) is not exercisable in CI.", "why_skipped": "8192 is the deepseek-v4 output limit and the confirmed-working total was 5000, so 8000 is safe with margin; the clamp + a 400-surfacing log are the guard, and a wrong assumption is a one-constant revert.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-13T13:21:00Z", "outcome": "Opened + assessed: bounded risk (very likely 8192), recoverable, and instrumented — the founder's next call confirms it live." }
]
```

## Un-named reliance
- Relies on the deployed deepseek model's output limit being ≥ 8000 (8192 standard; 5000 confirmed working) so the
  clamp never 400s. The enhanced log surfaces a violation immediately.

## Status
Complete; full gate exit 0 (pasted above). The next real call is the live confirmation (its log will show
finish_reason:"stop" instead of "length", or, if still short, the exact completion_tokens). Commit + push.
