> # ⚠️ SUPERSEDED — 4 September 2026. Do not act on this file.
>
> **The shim described below is merged and live on TeamPilot's `main`.** So is the
> follow-up work: `resolveApiAuth`, `callerScopedDb`, and every coach route the app
> calls. There is nothing here left to apply.
>
> Two statements below were true when written and are now false, which is why this
> banner exists rather than a quiet edit:
>
> - *"I have not made it."* — I have. The shim was applied, and later work went
>   directly into TeamPilot on review branches.
> - *"TeamPilot is not one of my working directories."* — it is now.
>
> **If you are shipping, the files you want are `DEVICE-CHECK.md`,
> `APP-STORE-SUBMISSION.md` and `APP-STORE-LISTING.md`.** This one is kept only as
> a record of what the change was and why, for anyone reading the history.

# The Bearer shim — ready to apply to TeamPilot

You chose `deploy_kpi` on the board, and Phase 2 is finished, so this is the change
that unblocks it. **I have not made it.** TeamPilot is not one of my working
directories, and this widens who can authenticate on a live product — that is
yours to apply and review.

The app side is already built and waiting: `src/app/(app)/kpi.tsx` calls
`GET /api/coach/kpi/me?scope=self` with the Bearer token today. Until this lands
it gets a 401, and the screen says so honestly rather than telling a rep to sign
in again on a loop that cannot end.

## What I verified against your actual repo

Not against the plan document — against the code, because they disagree in one
place that matters.

| Check | Result |
|---|---|
| `src/lib/api/resolveApiAuth.ts` already present? | No — the file is new |
| `createAdminClient` in `@/lib/supabase/admin` | present (line 18) |
| `getCurrentAuthContext`, `AuthContext` in `@/lib/supabase/auth-helpers` | present (lines 54, 47) |
| `isAdminRole` in `@/lib/roles` | present (line 42) |
| `AuthContext` shape matches what the routes consume | yes — `{ userId, companyId, role, isAdmin }` |
| Bearer-via-`admin.auth.getUser` is already a proven pattern here | yes — `src/lib/api/extensionAuth.ts` |

**The discrepancy.** `06-BACKEND-BEARER-SHIM.md` says the change is one line
because "`req` is already in scope: `GET(req: Request)`". That is true for
`kpi/me` (line 53). It is **not** true for the other two:

- `src/app/api/coach/kpi/team/route.ts:43` → `export async function GET() {`
- `src/app/api/coach/kpi/trajectory/route.ts:18` → `export async function GET() {`

Applying the documented one-liner to those two would not compile. They need the
parameter added as well. The steps below account for that.

## Step 1 — add the helper

Copy, unchanged:

```
SALES-COACH-BUILD-ARCHITECTURE/inject/backend-patch/resolveApiAuth.ts
  →  TeamPilot/src/lib/api/resolveApiAuth.ts
```

It tries the cookie session first, so **every existing web caller is untouched**,
and falls back to the Bearer token. It fails closed on a missing profile or a
`removed` account, mirroring `requireExtensionAuth`.

## Step 2 — wire the three KPI routes

`src/app/api/coach/kpi/me/route.ts` (line 3 and line 55) — the documented case:

```diff
-import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
+import { resolveApiAuth } from "@/lib/api/resolveApiAuth";

 export async function GET(req: Request) {
-  const ctx = await getCurrentAuthContext();
+  const ctx = await resolveApiAuth(req);
```

`src/app/api/coach/kpi/team/route.ts` (line 3, 43, 45) — **also takes the parameter**:

```diff
-import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
+import { resolveApiAuth } from "@/lib/api/resolveApiAuth";

-export async function GET() {
+export async function GET(req: Request) {
-  const ctx = await getCurrentAuthContext();
+  const ctx = await resolveApiAuth(req);
```

`src/app/api/coach/kpi/trajectory/route.ts` (line 3, 18, 20) — identical to `team`.

Everything below each of those lines is unchanged. `isAdmin` gating, company
scope and the RLS-scoped queries all keep consuming the same `AuthContext`.

## Step 3 — prove both paths, not just the code

This is the part that matters, and it is the part a green typecheck cannot give
you. The change widens *who can authenticate*, so the test that earns it is that
one rep's token never returns another rep's rows.

```bash
# 1. The web path is unchanged. Hit /api/coach/kpi/me from a logged-in browser.
#    Expect 200 and the SAME numbers as before the change.

# 2. The mobile path now works.
curl -s https://elostate.com/api/coach/kpi/me?scope=self \
  -H "Authorization: Bearer <access token for test rep A>" | jq .
#    Expect 200, and rep A's numbers.

# 3. It fails closed.
curl -s -o /dev/null -w '%{http_code}\n' https://elostate.com/api/coach/kpi/me \
  -H "Authorization: Bearer garbage"
#    Expect 401. A removed account's token: also 401.

# 4. The drift guard. Rep A's token must never return rep B's rows.
#    Compare the sessionCount and sourceSessionIds against rep A's own sessions.
```

Then TeamPilot's own ceremony — `npm run check` and the TBC entry — since this is
an auth change in that repo, not this one.

## What happens in the app the moment it lands

Nothing to rebuild. The client already sends the Bearer on every call
(`src/lib/coach-api.ts`), so "Your numbers" starts returning data on the next
pull-to-refresh. The screen renders whatever metric set the server sends,
including keys this build has never seen, and shows a gated metric as *building*
rather than as a zero.

**Audio (the other half of Phase 3) is not covered here.** It needs
`…/upload-recording/sign` and `…/upload-recording` wired the same way, plus
recording on the device. Worth doing as its own change once the KPI path has
proven the shim in production.
