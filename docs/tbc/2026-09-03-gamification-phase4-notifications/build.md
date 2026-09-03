# BUILD — Gamification Phase 4 (manager notifications)

### The notify module
- write-path: `src/lib/coach/gamification/notify.ts` — resolveManagers (company admins / sales-coach admins, minus
  the agent) + notifyStrongSession / notifyDealClosed; upsert-ignore (idempotent); agent name resolved once;
  best-effort.
- read-path: a strong session / closed deal creates one notification per manager, at most once.

### The wires
- write-path: `generateAndStoreAfterPitch.ts` fires notifyStrongSession when the banked session is strong;
  `.../[id]/outcome/route.ts` fires notifyDealClosed when outcome='sold'.
- read-path: managers get alerted the moment a review scores strong or a deal is recorded — without either flow
  being able to break (best-effort).

### The bell + routes
- write-path: `/api/coach/gamification/notifications` GET (list + unread, RLS recipient-scoped) + POST (mark-read,
  service-role pinned to the caller). `NotificationBell.tsx` bell + badge + dropdown + mark-all-read, placed on the
  Scoreboard (manager-only).
- read-path: a manager sees an unread badge, opens the list, and each alert links to the session's after-pitch.

## Files
- `src/lib/coach/gamification/notify.ts` (NEW) + `__tests__/notify.test.ts` (NEW)
- `src/lib/coach/v5/generateAndStoreAfterPitch.ts`, `src/app/api/coach/sales-session/[id]/outcome/route.ts` (wires)
- `src/app/api/coach/gamification/notifications/route.ts` (NEW), `src/components/sales-coach/NotificationBell.tsx` (NEW)
- `src/components/sales-coach/Scoreboard.tsx` (bell placement), `src/lib/coach/v5/__tests__/generateAndStoreAfterPitch.test.ts` (wire guard)

## Ripple (§6 item 5)
- No schema change (the tables exist from Phase 1). Both wires are best-effort → the review + outcome flows are
  unaffected on a notify failure.
- Mark-read is service-role but pinned to recipient_id = the caller → no one marks another's notifications.
- In-app only; no email/push/realtime dependency added (founder + codebase constraint).
