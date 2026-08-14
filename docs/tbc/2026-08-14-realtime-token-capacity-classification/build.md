# BUILD — live-STT token mint capacity classification

### mintRealtimeSttToken carries the HTTP status
read-path: `src/lib/care/voice/elevenlabs.ts` `mintRealtimeSttToken` — on a non-2xx it now throws an Error with
`.status` (was the status only in the message string).
write-path: none (a network read + throw). Enables the route to classify without regexing a message.

### /realtime-token classifies the failure honestly
read-path: `src/app/api/coach/sales-session/realtime-token/route.ts` catch reads `(err).status`.
write-path: returns 503 `{retryable:true}` "busy — too many sessions starting at once, try again" on 429; 502
`{retryable:false}` "temporarily unavailable on this account" on 402/403; else the generic 502 couldn't-start.
Every branch still points at the Upload-recording fallback. The success path + auth gate are unchanged.

## Test coverage
`src/app/api/coach/sales-session/realtime-token/__tests__/route.test.ts` (NEW, 5): 401 unauth (no mint); 200 +
token on success; 429 → 503 retryable "busy"; 402/403 → 502 not-retryable; an unclassified failure → 502 generic
pointing at upload.

## Out of scope (flagged — the concurrent-STREAM limit)
The ElevenLabs CONCURRENT-STREAM cap is enforced when the browser opens the wss WITH the token (a different
layer than the token mint). Detecting that rejection + surfacing it loudly (so a session can't silently capture
nothing) touches the delicate live-coaching client AND needs the real provider wss-rejection shape — flagged for
a dedicated, founder-gated build, not guessed here.
