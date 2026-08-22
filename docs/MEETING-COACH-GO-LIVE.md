# Meeting Coach (Team-Sync) — Go-Live Checklist

Meeting Coach + Prep-up are **built and deploy-verified** but **gated OFF** until the steps below are done. The
code is safe to have in production while gated: the nav entry is hidden, and the pages default to the sales path
pre-migration (A34-safe). This doc is the §1.5.3 record of the **external preconditions the repo cannot hold** —
do these in order.

## Preconditions (blocking — founder)

### 1. Apply the migrations ✅ DONE (2026-08-23)
Migrations 0237 + 0238 are applied (schema verified: `session_kind` + `meeting_preps` + `meeting_prep_documents`
live) and the ledger is reconciled (`db:reconcile` → 0 drift; `db:dry` → nothing pending). They were applied
outside the ledgered runner, which left an off-ledger drift on 0238 (its `create policy` isn't idempotent) — that
was reconciled by recording 0237/0238 in `public._agent_migrations` (baselined) without re-running the SQL.
**Lesson for next time: run `npm run db:apply` (below) so the ledger records it automatically — avoids the drift.**
```
npm run db:apply
```
Applies (both additive + idempotent):
- **0237_coaching_session_kind.sql** — `coaching_sessions.session_kind` (sales | meeting | huddle, default sales).
- **0238_meeting_prep_up.sql** — `meeting_preps` + `meeting_prep_documents` (Prep-up tables, company-scoped RLS).

⚠ Use `npm run db:apply` — never hand-apply (hand-applied → off-ledger drift → the next apply fails).

Verify after apply (behavioral, not catalog-string):
```
-- session_kind exists + defaults sales
select column_default from information_schema.columns
  where table_name='coaching_sessions' and column_name='session_kind';   -- → 'sales'::text
-- prep tables exist + are RLS-locked
select relrowsecurity from pg_class where relname in ('meeting_preps','meeting_prep_documents');  -- → t, t
```

### 2. Turn on the nav flag + redeploy
Set the env var on the **correct Vercel project** (the one serving elostate.com — check `/api/health` deploymentUrl
if unsure), then redeploy:
```
NEXT_PUBLIC_MEETING_COACH_ENABLED = true
```
`NEXT_PUBLIC_*` is inlined at build time, so a redeploy is required for it to take effect. Until it's `true`, the
"Meeting Coach" nav entry does **not** appear in the global sidebar (hub accounts) or the Sales Coach shell
(sales_coach accounts) — the feature stays reachable only by direct URL. This is deliberate: the nav must not
advertise the feature before its DB is in place.

### 3. Device validation (real hardware)
Meeting Coach's live capture (mic → Scribe → cue → earpiece) and N-party attribution are the only parts that
can't be verified headless. Protocol: `docs/MEETINGCOACH-DEVICE-VALIDATION.md`. Run a real in-person meeting +
huddle, confirm cues arrive and the post-meeting review + agenda coverage render.

## What's already wired (no action needed)
- Entitlement: `/dashboard/meeting-coach` is classified as part of the **sales_coach** module
  (`moduleForPath`), so a sales_coach-locked account reaches it (a care-locked account does not; hub accounts
  always do). The Sales Coach shell surfaces the entry; the global sidebar surfaces it for hub accounts.
- Prep-up loop (collect → agenda-aware live coach → agenda-scored Dissect review), the `/end` route, and the
  capture-diagnostics instrumentation are all shipped.

## Verify go-live worked
After steps 1-2 + redeploy: a sales_coach (or hub) account sees "Meeting Coach" in the nav → Prep a meeting →
start it → cues arrive → end → the review shows decisions/actions + agenda coverage. If the nav entry is missing,
the flag isn't set on the serving project (step 2); if the page errors on load, the migrations aren't applied
(step 1).

## Rollback
Set `NEXT_PUBLIC_MEETING_COACH_ENABLED=false` (or unset) + redeploy → the nav entry disappears; the migrations are
additive + A34-safe, so they can stay applied with no effect on the sales path.
