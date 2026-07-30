# BUILD — C.A.R.E Notifications (comprehensive settings, pillar 3)

Files:
- `supabase/migrations/0204_care_notify_pref.sql` (NEW, APPLIED) — `profiles.care_notify_customer_reply
  boolean not null default true`. Additive; default = current behavior.
- `src/app/api/me/care-notifications/route.ts` (NEW) — GET + PATCH, self-scoped (profiles RLS), A34-guarded
  (isMissingColumnError → GET degraded:true / PATCH 409). Mirrors /api/me/theme.
- `src/lib/notifications/careNotify.ts` — reads the pref before pushing; explicit false → early return; any
  pref-read error (incl. missing column) → fall through to send. Stays fire-and-forget.
- `src/components/care/CareNotificationsPanel.tsx` (NEW) — the toggle (optimistic, reverts on error, shows
  the degraded/migration-pending note).
- `src/app/dashboard/care/settings/general/page.tsx` — renders the panel on the General tab.
- `src/lib/notifications/__tests__/careNotify.test.ts` — +4 gating tests.

### Per-user C.A.R.E notification opt-out (real, wired to the send path)

- write-path: **exists** — CareNotificationsPanel → PATCH /api/me/care-notifications → profiles.care_notify_
  customer_reply. human_can_set: **yes** — a switch on the General tab.
- read-path: **exists** — careNotify.ts reads the assigned agent's pref before sendPushToUsers; explicit
  false suppresses the push. human_can_see: **yes** — no push arrives when off; the inbox still shows it.
- reachability: **BUILT** — write + read both present + test-locked (8/8). Not dead surface.

### A34 degrade

- write-path guard: route returns 409 / degraded:true if 0204 absent. read-path guard: careNotify falls
  through to SEND on any pref-read error. reachability: **BUILT** — test "STILL pushes when column missing".

## Verification (A38)

`npx tsc --noEmit` → 0. `vitest careNotify` → 8/8. `db:apply 0204` → DB at 0204; `verify:live` → 14/14.
