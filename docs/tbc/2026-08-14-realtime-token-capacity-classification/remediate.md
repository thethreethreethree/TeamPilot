# REMEDIATE — live-STT token mint capacity classification

## F1 — classify the token-mint failure by provider status
Remediation: `mintRealtimeSttToken` attaches the HTTP `.status` to the thrown error; `/realtime-token` classifies
it — 429 (too many token requests at once, under concurrent load) → 503 `{retryable:true}` "busy, try again";
402/403 (account quota/billing/plan) → 502 `{retryable:false}` "temporarily unavailable on this account"; else
the generic 502 couldn't-start. Every branch still points at the Upload-recording fallback, so no transcript is
lost regardless of the cause.
gate-or-promise: gate. The route test locks the classification (429→503 retryable "busy"; 402/403→502
not-retryable; unclassified→502 generic pointing at upload; success→200 + token). Collapsing back to one message
reddens CI.
class: honesty / diagnostic-visibility (concurrency path). severity: medium. Fixed.

## Deferred (flagged — the concurrent-STREAM cap)
The ElevenLabs concurrent-stream limit at the browser wss is a separate layer; detecting + loudly surfacing that
rejection needs the real provider wss-rejection shape and touches the delicate live-coaching client — a dedicated,
founder-gated build, not guessed here.
