# 06 — The Phase-2 Backend Bearer Shim

**What it is:** one small helper in the **TeamPilot** repo that lets the coach routes accept *either* the web SSR
cookie session *or* a mobile `Authorization: Bearer <access token>`. It unlocks KPIs + audio + session-write
routes for the app **while reusing the exact server logic** (no duplication, no drift).

**Why it's needed:** today, `sales-session/**`, `kpi/**`, and the audio routes resolve the user from the **web
cookie** (`createClient()` → `getUser()`). A mobile Bearer token doesn't authenticate against them. Only the
`extension/**` AI routes accept Bearer. This shim closes that gap the same way the extension already does —
`admin.auth.getUser(token)` — so it's a proven pattern, not new surface.

## The patch

`inject/backend-patch/resolveApiAuth.ts` → copy to `src/lib/api/resolveApiAuth.ts` in TeamPilot.

It returns the **identical `AuthContext`** shape the routes already consume from `getCurrentAuthContext()`
(`{ userId, companyId, role, isAdmin }`), so downstream logic — RLS-scoped queries, `isAdmin` gating, company
scope — is untouched. Cookie is tried first (web unchanged); Bearer is the fallback (mobile). It fails closed on
a missing profile or a `removed` account, mirroring `requireExtensionAuth`.

## Wiring a route (one line)

```ts
// src/app/api/coach/kpi/me/route.ts
- const ctx = await getCurrentAuthContext();
+ const ctx = await resolveApiAuth(req);          // req is already in scope: GET(req: Request)
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // ...everything below is unchanged
```

Apply to the routes the app needs, in priority order:
1. `GET /api/coach/kpi/me` (+ `kpi/team`, `kpi/trajectory`) — the KPI board.
2. `POST /api/coach/sales-session/[id]/upload-recording/sign` and `…/upload-recording` — audio.
3. `GET/POST /api/coach/sales-session` and `…/[id]/**` — full session CRUD from the app (if/when you want writes
   through the routes rather than direct-Supabase).

## Verifying the shim (TeamPilot discipline: the real command + evidence, A38)

This is a TeamPilot change, so it rides TeamPilot's ceremony (TBC dir, `npm run check`, migration rules if any).
Behavioral check that proves BOTH auth paths, not just the code:

```
# cookie path unchanged (web): hit the route from a logged-in browser → 200, same numbers as before.
# bearer path (mobile): with a valid access token for a test rep —
curl -s https://elostate.com/api/coach/kpi/me -H "Authorization: Bearer <access_token>" | jq .
#   → 200 with that rep's KPIs (scope=self). A garbage token → 401. A removed account's token → 401.
```

Ship it behind the same review as any auth change: it widens *who* can authenticate, so the drift-guard is a test
that a Bearer for user A never returns user B's rows (RLS + the ownership branch both hold).

## Why not just do direct-Supabase for these too?

KPIs are a **computed decision**, not raw rows — re-deriving the formula on the device is the §2.2 drift defect
(the server's KPI compute already had to fix a real duration-outlier bug; a device copy would not have that fix).
Audio needs the server to mint the signed upload target and run transcription. So these belong on the server; the
shim is the smallest change that lets the app reuse them.
