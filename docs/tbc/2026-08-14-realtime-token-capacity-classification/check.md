# CHECK — live-STT token mint capacity classification

## Verification run (A38)
Canonical command: `npm run check`. Full-gate output + exit code in closure.md.

## Findings

### F1 — every live-STT token-mint failure collapsed to ONE generic message (no honest capacity signal)
file+line: `src/app/api/coach/sales-session/realtime-token/route.ts` catch (was one 502 for all causes) ×
`src/lib/care/voice/elevenlabs.ts` `mintRealtimeSttToken` (status was message-only).
class: honesty / diagnostic-visibility on the concurrency path (a transient 429 capacity blip and a hard
402/403 account limit read identically → a rep can't tell "wait + retry" from "broken").
severity: medium (surfaces under concurrent multi-agent load — the founder's exact concern; a busy-hour blip
looked like an outage).
sweep-command: `grep -n "status === 429\|retryable" src/app/api/coach/sales-session/realtime-token/route.ts`
— the route now branches on the provider status.
read-path: fixed — 429 → 503 retryable "busy"; 402/403 → 502 "account limit"; else generic; all point at upload.

## Class sweep (A26)
The provider-capacity-under-concurrency class has two instances: the token-mint rate limit (this fix) and the
concurrent-STREAM cap at the browser wss (flagged for a dedicated build — needs the real provider wss-rejection
shape + touches the live-coaching client; not guessed). The token-mint instance is closed here.

## Tests
```
$ npx vitest run realtime-token
 Test Files  1 passed (1)
 Tests  5 passed (5)
```
Locks the 429→503-retryable / 402-403→502 / unclassified→502-generic / success→200 classification. Full gate +
exit code in closure.md.
