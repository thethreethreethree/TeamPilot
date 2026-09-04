# BUILD - the coach memory honours the caller's own client

### The caller's client reaches the memory read
- write-path: `src/lib/coach/v5/memory.ts` - `loadCoachMemory` takes an optional
  `db?: SupabaseClient` and uses `db ?? (await createClient())`. The header records
  the outage, why the empty snapshot was worse than an error, and which clauses it
  quietly broke.
- read-path: a C.A.R.E extension user's coach now sees their accumulated patterns
  and grade mix instead of behaving as though it had never met them.

### The route hands over the client it can already build
- write-path: `src/app/api/care/extension/coach/route.ts` - passes
  `callerScopedDb(req) ?? undefined`. The route is Bearer-authenticated by
  `guardExtensionRequest`, so the caller's identity was available all along; it was
  simply never given to the reader.
- read-path: the prompt regains its `USER PATTERN HISTORY` block, which is the only
  place the coach's accumulated knowledge becomes visible to a user (SS3.6).

### NOT the service client, and the distinction is the point
- write-path: the same optional-parameter shape used for `data/doorlog.ts`, not the
  service client used for `lib/brain`. Brain reads COMPANY CONFIG behind a
  server-resolved id, so bypassing RLS widened nothing. This reads a PERSON'S OWN
  event history, where RLS plus the per-row actor filter is the access control, so
  bypassing it would widen access rather than restore it.
- read-path: a user still sees only their own history, by the same rules as before.

### The gate (A30)
- write-path: `src/lib/coach/v5/__tests__/memory.callerClient.test.ts` mocks
  `createClient` to THROW, so any fallback to the cookie session is visible. A
  fourth test pins the other half: omitting `db` still uses the cookie session.
- read-path: this class cannot silently return an empty memory again.
  Mutation-proven - reverting the one line fails three named tests, two of them
  describing the user-visible consequence rather than the mechanism.

## Files
- `src/lib/coach/v5/memory.ts`
- `src/app/api/care/extension/coach/route.ts`
- `src/lib/coach/v5/__tests__/memory.callerClient.test.ts`

## Ripple (SS1.5)
- `db` is optional, so the two cookie callers (`care/agent/.../ask-coach` and the
  dashboard) are untouched; a test pins that.
- `loadCoachMemory` keeps its swallow-and-return-empty contract for the genuine
  cases (no session, Supabase down). Only the caller's ability to say who is asking
  changed.
- The transitive sweep found no other Bearer route reaching a cookie-only library
  once the circular heuristic was removed. The survivors are listed in check.md F2.
