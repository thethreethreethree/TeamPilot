# CHECK — Realtime manager notifications

## Typecheck — `npm run typecheck`
```
> tsc --noEmit
exit: 0
```

## Migration — `npm run db:apply`
```
✅ ALL 30 invariants hold.
[db-apply] ✓ verify:live passed — structural invariants intact after the migration.
exit: 0
```

## Publication + RLS — live behavioral probe (pg_publication_tables / pg_policies)
```
supabase_realtime publication exists      => [{"pubname":"supabase_realtime"}]
manager_notifications in publication?      => [{"tablename":"manager_notifications"}]
manager_notifications RLS enabled          => [{"relrowsecurity":true}]
its recipient RLS policy                   => [{"policyname":"manager_notifications - recipient read","cmd":"SELECT"}]
ledger tail                                => [{"version":"0245"},{"version":"0244"},{"version":"0243"}]
```
The table is published and RLS-gated to the recipient — so Realtime delivers each manager only their own INSERTs.

## Bell realtime tests — `npx vitest run .../NotificationBell.render.test.tsx`
```
 Test Files  1 passed (1)
      Tests  4 passed (4)
exit: 0
```
Coverage (4-of-4): subscribes to `manager-notifs:<uid>` with `filter recipient_id=eq.<uid>` on INSERT of
`manager_notifications`; re-fetches when an INSERT arrives; tears the channel down on unmount; renders the unread
badge from fetched state. The Supabase browser client is faked.

## Not claimed (§1.5.3 / A38 — the sandbox can't hold a browser socket)
- The client WebSocket HANDSHAKE (Realtime actually delivering over the wire) is NOT exercised here — no browser /
  authed socket in the sandbox. It is confirmed on deploy. The poll fallback guarantees "live within 60s" even if
  Realtime is disabled or the socket fails, so the feature never regresses below today's behavior.
- Full `npm run check` runs at pre-commit (tbc gate) + on merge.

## Findings
- No findings / no defects. The one honest limit (client-socket verification) is a sandbox constraint, mitigated by
  the retained poll and confirmed on deploy — not a defect.
