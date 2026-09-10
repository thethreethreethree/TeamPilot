# BUILD - give the KPI routes the caller's own client, and widen the guard that missed them

### The four routes
- write-path: `coach/kpi/me`, `coach/kpi/team`, `coach/kpi/trajectory` - one line each,
  `const sb = callerScopedDb(req) ?? (await createClient())`. The web path is unchanged by construction:
  `callerScopedDb` returns null without a Bearer header, so the expression falls through to what was there.
- write-path: `coach/sales-session/quota` - the same, plus `GET(req)` where it was `GET()`, plus
  `getCurrentAuthContext() ?? resolveApiAuth(req)` so the mobile identity resolves at all.
- read-path: the app's KPI, Trend and Team screens read the rep's real numbers instead of a confident zero,
  and a company admin is no longer told they are not a manager.

### Two latent traps closed rather than allowlisted
- write-path: `coach/sales-session` GET took no request, so it could never answer a Bearer caller; the app
  does not call it (it reads sessions straight from Supabase), so this was a trap for whoever wires it next.
- write-path: `coach/sales-session/[id]/segments` POST resolved a bare cookie client while the GET beside it
  was already scoped - a route that reads correctly on one verb and anonymously on the other.
- read-path: neither is called by the app today, so nothing a rep sees changes. What changes is what the NEXT
  caller gets: a Bearer request to either now reads as itself rather than as nobody, so wiring the sessions
  list or a live-coaching segment post from the app cannot reproduce the class a third time.

### The guard (A30, A21)
- write-path: `scripts/invariant-audit.mjs` - INVARIANT 26 now also inspects the ROUTE'S OWN BODY, which its
  `n !== start` and `src/lib/` conditions had excluded. It counts rather than matches, because the correct
  pattern `callerScopedDb(req) ?? (await createClient())` necessarily contains the string it was looking for,
  in two spellings (one statement and two).
- read-path: a Bearer route that resolves a bare cookie client fails `npm run invariant:audit` by name.
- gate-or-promise: `npm run invariant:audit` - proven by mutation: reverting `kpi/me` to the bare cookie
  client took the audit from 0 violations to 1, naming that exact file, and restoring took it back to 0.

## Files
- `src/app/api/coach/kpi/me/route.ts`
- `src/app/api/coach/kpi/team/route.ts`
- `src/app/api/coach/kpi/trajectory/route.ts`
- `src/app/api/coach/sales-session/quota/route.ts` (+ its tests, for the new GET signature)
- `src/app/api/coach/sales-session/route.ts`
- `src/app/api/coach/sales-session/[id]/segments/route.ts`
- `scripts/invariant-audit.mjs`

## Ripple (1.5)
- No schema change, no policy change, no new dependency.
- Every existing web caller keeps the cookie client, because that is the fallback.
- The quota tests now pass a request object with no Authorization header, which keeps their expectations on
  the cookie path exactly as before.
- The widened rule found and closed two more routes; it reports 0 violations across 1012 files afterwards.
