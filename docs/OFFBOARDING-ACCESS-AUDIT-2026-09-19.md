# Removing a member does not remove their access

**Found:** 2026-09-19, while provisioning two Align Sales Pros agents by hand.
**Status:** OPEN — no code changed. This is a finding, not a fix.
**Severity:** high for a sales product whose reps churn.

---

## The claim, in one line

When an admin removes a member, that person keeps working access to the web dashboard and to
roughly 22 coach API routes, for as long as their refresh token keeps renewing — which nothing
revokes.

## What removal actually does

`src/app/api/team/route.ts:276`

```
.update({ status: "removed", removed_at: new Date().toISOString() })
```

That is the entire operation. It is a soft flag. It does **not**:

- call `auth.admin.signOut` or `auth.admin.deleteUser` on the session,
- ban the user,
- null `company_id` — so their profile still reads as a member of the tenant.

A sweep for session revocation anywhere in `src/` turns up exactly one `deleteUser`, and it is the
rollback path inside `add-member` for a half-created account. Nothing offboards a session.

So after removal the person still holds a valid access token AND a valid refresh token. Everything
now depends on whether each read path checks `status`.

## Who checks, and who does not

**Checks `status === 'removed'` and fails closed — 3 places:**

| where | covers |
|---|---|
| `requireExtensionAuth` (`src/lib/api/extensionAuth.ts:59`) | the browser extension surface |
| `resolveApiAuth` (`src/lib/api/resolveApiAuth.ts:47`) | ~8 mobile-Bearer routes |
| `resolveApiUserId` (`src/lib/api/resolveApiAuth.ts:92`) | identity-only routes |

**Does NOT check — the web app's own front door:**

- `getCurrentAuthContext` (`src/lib/supabase/auth-helpers.ts:59-64`) selects `company_id, role`
  only. This is the primary auth for the web app.
- `src/middleware.ts` — no reference to `status` at all.
- `src/app/dashboard/layout.tsx` — no reference to `status` at all. It gates on `company_id` and
  on `must_change_password`, not on membership being live.
- ~22 route handlers that authenticate with `sb.auth.getUser()` on the caller-scoped client and
  then read `profiles` without selecting `status` (e.g. `coach/doorlog/day-target`,
  `coach/sales-session/dissect`, `report-card`, `my-training`, `segments`, `upload-recording`).

## The data layer does not save it either

RLS is the last line, and it does not filter removed members. The canonical membership predicate,
e.g. `coaching_sessions` (`0070_live_sales_coach_foundation.sql:132-139`):

```sql
create policy "coaching_sessions - select" on coaching_sessions
  for select using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.company_id = coaching_sessions.company_id
    )
  );
```

Membership is `p.company_id = <row>.company_id`. Removal never clears `company_id`, so the
predicate stays true.

Swept rather than sampled: 34 migration files contain a `from profiles p` predicate. Exactly
**one** line in the whole schema requires that member to be live —
`0172_fin_report_schedules.sql:96`:

```sql
and p.status     = 'active'           -- still an active member (not removed)
```

The other three `p.status` matches are not profiles at all; `p` is `projects` there
(`0148_fin_profitability_views.sql`, `0178_fin_integrity_check.sql`).

**That comment is the finding's sharpest edge.** Someone already understood this, wrote the reason
inline, and applied it to finance report schedules. It propagated to nothing else. A lesson held in
prose in one file (A30).

## Why it stayed invisible

The three gates that DO check are the newest code — the extension gate and the mobile Bearer path,
both written with a fresh threat model and both carrying the comment "fail closed". The web path is
the oldest and was written when removal did not exist yet. Nothing ever went back.

It is also invisible to every automated check by construction: typecheck, lint, the RLS audit
(which asks whether policies pin the *tenant*, not whether they pin *live membership*), and the
invariant audit (which asks whether a route is gated, not what the gate omits) all pass. This is
the §5 confident-well-formed-failure at the authorization boundary.

## What a fix looks like

Ordered cheapest-first. These are not exclusive; 1 is the floor and 3 is the real fix.

1. **Add `status` to `getCurrentAuthContext`** — one column in one select, return `null` when
   removed. Closes the web dashboard and every route built on the cookie context. Does not close
   the ~22 scoped-client routes that authenticate independently.
2. **Revoke the session at removal** — `auth.admin.signOut(userId, 'global')` in the DELETE
   handler. Kills the refresh token so the window closes immediately instead of at token expiry.
   Belt-and-braces with 1, and the only thing that helps against a token already in someone's
   hands.
3. **Move membership into the RLS predicate** — add `and p.status = 'active'` to the membership
   `exists (...)`, matching what `0172` already does. This is the version that cannot be forgotten
   by the next route someone writes, because there is no route-level thing to remember. It is also
   the widest blast radius and wants care: every policy touched, and a drift-guard test.

The §2.2 shape underneath all three: "is this caller a live member of this tenant" is a decision
currently computed in four different places with four different answers. It should be one
authority returning a verdict.

## Not verified

- No removed account was tested live. Setting a real user to `removed` in production to prove the
  read succeeds is destructive, and was not done. The finding is traced through source and schema,
  not reproduced end-to-end. That distinction is deliberate and should be closed on a staging
  tenant before any fix is accepted as working.
- Supabase JWT lifetime and refresh-token rotation settings were not read from the dashboard, so
  "how long is the window" is unquantified. It is at minimum one access-token lifetime and at
  most indefinite while the refresh token is honoured.
