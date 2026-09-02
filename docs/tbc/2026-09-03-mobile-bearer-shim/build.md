# BUILD — accept a mobile Bearer token on the coach routes

## Feature inventory

Each entry names both seams (A31): the **write-path** is how a caller's request reaches
the database or the model; the **read-path** is how the result reaches a surface a human
sees. Nothing here adds a table or a screen — this build restores both paths for a caller
the routes previously could not identify.

### Bearer identity on the KPI routes

`src/lib/api/resolveApiAuth.ts` (new) resolves the caller from the web SSR cookie first,
then from `Authorization: Bearer <supabase access token>` validated via
`admin.auth.getUser(token)` — exactly as `requireExtensionAuth` already validates one. It
returns the identical `AuthContext` (`{ userId, companyId, role, isAdmin }`) the routes
already consume, and fails closed on a missing profile or a `removed` account.
`kpi/{me,team,trajectory}` swap `getCurrentAuthContext()` for `resolveApiAuth(req)`.
`team` and `trajectory` were declared `GET()` with no parameter and gained `req: Request`;
the plan document's claim that `req` is already in scope holds only for `me`.

- **write-path:** none — these three routes are pure reads. The identity they resolve is
  what scopes every query below it, and that is the path this change repairs.
- **read-path:** the mobile KPI board, month-by-month trend and team roster call these
  three routes. They render an honest "not switched on yet" on today's 401 and will start
  receiving data the moment this is deployed. The manager gate on `kpi/team` still returns
  403 "Manager access required."; the app distinguishes that from the 401, because they
  mean opposite things.

### Bearer identity on session create

`src/app/api/coach/sales-session/route.ts` takes its identity from `resolveApiAuth`.

- **write-path:** `createSession` writes through `createServiceRoleClient()`
  (`src/lib/data/salesCoach.ts:165`), so identity alone is sufficient here and no scoped
  client is needed. The row is written with the `company_id` from the resolved context.
- **read-path:** the created row is returned to the caller and is immediately visible in
  the app's session list, which reads `coaching_sessions` direct from Supabase under RLS.

### RLS-scoped database access for a Bearer caller

`src/lib/api/callerScopedDb.ts` (new) builds a Supabase client from the **anon key plus
the caller's own JWT**, or returns null when there is no Bearer header. It reads the
header defensively (`req?.headers?.get?.`), because these routes are legitimately called
with minimal request-shaped objects in their own tests. `src/lib/data/salesCoach.ts` —
`getSession` and `getSessionTranscript` take an **optional** `client`, defaulted, so all
existing callers are byte-identical in behaviour.

- **write-path:** `/[id]/outcome`, `/[id]/upload-recording`, `/[id]/upload-recording/sign`
  and `/[id]/label-transcript` each make **one substitution** — the client:
  `const supabase = scoped ?? await createClient()`. Every existing line below it
  (`auth.getUser()`, the `profiles` read, `getSession`) then works unchanged for both
  callers. `getCurrentCompanyId()` builds its own cookie client and is null for a mobile
  caller, so it falls back to the company on the caller's own profile row, read through
  their scoped client.
- **read-path:** `getSession(id)` **is** the access check on all four. Without a scoped
  client it returns nothing for a Bearer caller, and the route 404s a session that exists.
  In `/label-transcript` the same emptiness is worse than a 404: `getSessionTranscript`
  is the guard that stops an existing transcript being clobbered, and reading it empty
  takes the **append** path instead of the atomic replace — one call, doubled transcript.

### Test-harness and audit maintenance

`src/app/api/coach/kpi/{team,trajectory}/__tests__/*` — `GET()` → `GET(req())` at 14 call
sites, using the same tiny request helper the `kpi/me` tests already use. No assertion was
changed. `scripts/invariant-audit.mjs` matches auth gates by name (`ROUTE_AUTH_RE`); it
did not know the new helpers and flagged `/outcome` as an ungated mutation — correctly, by
its own rules. Both names are added with the reason recorded in the comment above, and
**three self-tests** beside the existing ones.

- **write-path:** none — no product behaviour is defined here.
- **read-path:** the audit's own output is the surface. Its three new self-tests assert it
  accepts a `resolveApiUserId` gate, accepts a `resolveApiAuth` gate, and **still rejects**
  an ungated mutation. This is the maintenance the audit's failure message invites ("gate
  it at the top, or allowlist here WITH the reason"). It is still a security guard, and it
  is the line in this branch most deserving of review.

## What changed mid-build

Two things were got wrong on the way and are recorded as findings in check.md rather than
tidied away: `/outcome` briefly required a company context it never required, and a helper
(`resolveApiDb`) was written on an assumption about the `profiles` read and then deleted
when reading the code showed the assumption was wrong. Reading `getSession` afterwards
showed the real problem, which is what `callerScopedDb` addresses.
