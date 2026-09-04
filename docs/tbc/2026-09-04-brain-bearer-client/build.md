# BUILD - brain reads the company's own config with the service client

### The client substitution in brain
- write-path: `src/lib/brain/index.ts` - `loadBrain()` and `loadControlGate()` now use
  `createAdminClient()` instead of `await createClient()`. A header comment records the outage, the
  evidence (anon read empty, service read present), and the ripple-trace that makes it safe.
- read-path: a Bearer caller - the mobile app and the browser extension - now gets its company's brain
  and control gate instead of a thrown "No brain row for company ...". `extension/suggest` and the
  door-log analysis stop returning 502 to every non-browser client.

### Roleplay gets somewhere for a throw to land
- write-path: `src/app/api/coach/sales-session/roleplay/route.ts` - the original handler is now
  `handleRoleplay`, and the exported `POST` wraps it in try/catch returning the shared
  `llmErrorResponse` taxonomy (A21) rather than a hand-rolled catch.
- read-path: a failure returns an LlmError's own status and `kind`, or one honest logged line - never
  an empty 500 that a client can only guess at.

### The control-gate tests keep biting
- write-path: `src/lib/brain/__tests__/runBrainCall.gate.test.ts` and `runBrainStream.gate.test.ts` -
  the fake db is supplied through `@/lib/supabase/admin` now that the code reads it there.
  `mockResolvedValue` becomes `mockReturnValue` because the admin factory is synchronous.
- read-path: no assertion changed. SS3.4 suppression is still proven by
  `expect(llmCall).not.toHaveBeenCalled()`.

## Files
- `src/lib/brain/index.ts`
- `src/app/api/coach/sales-session/roleplay/route.ts`
- `src/lib/brain/__tests__/runBrainCall.gate.test.ts`
- `src/lib/brain/__tests__/runBrainStream.gate.test.ts`

## Ripple (SS1.5, traced BEFORE the change)
Three callers reach `loadBrain`/`loadControlGate`, and not one takes a company id from a client:
- `/api/brain` reads `getCurrentCompanyId()`, resolved from the session.
- `runBrainCall` / `runBrainStream` read `args.companyId`, which every caller fills from the guard's
  server-resolved `user.companyId`.
- `src/lib/coach/doorlog/*` uses the same guard-resolved id.
Reading the company's OWN config with the service client therefore widens no boundary. The assumption
is documented at the read site so a future caller that accepts a client-supplied id must check it.
`unlockControlGate` keeps the cookie client deliberately: it is a web-only admin write.
