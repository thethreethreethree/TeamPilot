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


### Bearer identity on the door log

`src/app/api/coach/sales-session/door-log/route.ts` — the same one substitution
as the session routes: `const sb = callerScopedDb(req) ?? (await createClient())`,
on both POST and GET, plus the profile fallback for `getCurrentCompanyId()`.

Added after the first commit on this branch, because the phone app grew a Door
Log and this is the route it writes to. It is the surface that matters most to a
door-to-door rep — the owner's own web app runs in Macro Mode — and it was the
one coach route still closed to the phone.

- **write-path:** `POST { kind: "knock" }` creates the knock through
  `createKnock`, which the route reaches with the caller's own client. The route
  is idempotent on `client_knock_id`, and its own comment says why: *"offline
  queue may retry"*. The app stamps that id at the tap, so a retry over a bad
  connection cannot turn one door into three.
- **read-path:** `GET ?date=YYYY-MM-DD` returns that local day's totals for the
  caller alone — the row is pinned to `rep_id` so a manager does not sum the
  whole team through RLS. The phone shows its own local count beside it rather
  than blending the two, so a rep can see what the server actually has.


### Bearer identity on Today's Metrics

`src/app/api/coach/sales-session/todays-metrics/route.ts` — the same one
substitution. Added with the phone's Today's Metrics screen, the second
door-to-door surface.

- **write-path:** none. The route is read-only and says so; the rollups it reads
  are precomputed, so no LLM or transcription cost sits behind it.
- **read-path:** the phone's metrics screen renders the KPI trio, the score
  chart, the next-door focus and the growth opportunities from this response. It
  reproduces the route's own honesty rule rather than inventing one: a dimension
  absent from `scores` is not drawn, because a phantom zero would tell a rep they
  never ask questions when nothing was ever measured.


### Bearer identity on Pitch Performance

`src/app/api/coach/sales-session/report-card/route.ts` — the same one
substitution, completing the door-to-door trio the phone now mirrors.

- **write-path:** none. Read-only.
- **read-path:** the phone's Pitch Performance screen lists each recorded pitch
  with its outcome and, once analysed, its summary. The route left-joins the
  analysis because a fresh pitch has none; the screen says WHICH of those two a
  missing summary is, since only one of them is worth waiting for.

The RLS scoping is what makes this safe with a Bearer token rather than a
cookie: `repId` defaults to the caller, and a non-manager passing someone else's
id gets zero rows because the policy — not the parameter — decides.


### Bearer identity on Roleplay

`src/app/api/coach/sales-session/roleplay/route.ts` — the same one substitution.

- **write-path:** none that persists. The route is stateless by design — its own
  comment says a roleplay "must NOT pollute the rep's session history or
  metrics" — so the only write is the best-effort practice-score append on the
  focus-seeded branch, which the phone does not use.
- **read-path:** the phone holds the conversation and posts it whole each turn,
  rendering the prospect's reply and, at the end, the review. Because nothing is
  persisted, the phone is the only place a run exists while it is happening, and
  the screen is built around that: the review unlocks early, starting over asks
  first, and the 80-message cap is warned about before it is hit rather than
  discovered as a 400 mid-run.


### Bearer identity on Macro Mode, Training and the strategy library

Three more routes, the same one substitution each:
`macro-mode` (GET and POST), `my-training`, `strategy-library`. `macro-mode`'s
GET and `my-training` were declared with no request parameter and gained one, as
`kpi/team` and `kpi/trajectory` did.

**Macro Mode is the one that mattered most**, and not for its size. It is not a
preference — it swaps the product. The web shell keys BOTH its mobile tab bar and
its home layout off `profiles.macro_mode_enabled`, so a rep with it on gets the
door-to-door surfaces and a rep without gets the standard coach. The phone app
now mirrors that, which means this single boolean decides which of two apps a rep
opens. Without this route the phone could not read the setting and would show
every door-to-door rep the wrong product.

- **write-path:** `POST { enabled }` updates the caller's own profile row.
  RLS-scoped, so the policy rather than a parameter decides whose row is written.
- **read-path:** the phone reads it on launch, caches the answer so the app opens
  into the right product on the first frame, and corrects it when the server
  replies. A FAILED read never flips the product — the cached answer stands,
  because taking a rep's working layout away when they walk into a basement is
  worse than being briefly out of date.

`my-training` and `strategy-library` are read-only: the rep's own growth areas
and the company's one-liners.

## What changed mid-build

Two things were got wrong on the way and are recorded as findings in check.md rather than
tidied away: `/outcome` briefly required a company context it never required, and a helper
(`resolveApiDb`) was written on an assumption about the `profiles` read and then deleted
when reading the code showed the assumption was wrong. Reading `getSession` afterwards
showed the real problem, which is what `callerScopedDb` addresses.
