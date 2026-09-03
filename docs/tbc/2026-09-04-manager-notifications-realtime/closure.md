# CLOSURE — Realtime manager notifications

## What shipped
The manager NotificationBell now receives strong-session / deal-closed alerts LIVE via Supabase Realtime (founder
pick over a serverless-fragile SSE endpoint): a migration (0245) publishes `manager_notifications` to the
`supabase_realtime` publication, and the bell subscribes to this manager's own INSERTs (RLS-gated per subscriber)
and re-fetches instantly. The 60s poll is retained as the fallback for a dropped socket. First `.channel()` in the
codebase; reuses the existing browser client, notifications route, and recipient-RLS.

## Checks (A38 — commands + evidence in check.md)
`npm run typecheck` exit 0; `npm run db:apply` 30/30 + verify:live, exit 0; a live probe confirming the table is in
the publication + RLS-gated; `NotificationBell.render.test.tsx` 4-of-4. The client socket handshake is confirmed on
deploy (no browser socket in the sandbox) — the poll fallback keeps the feature safe meanwhile.

## The un-named reliance
- Relies on Supabase Realtime being ENABLED for the project (default on) and the browser client authenticating the
  socket with the user's session so the 0242 RLS applies — if either is off, the poll (retained) covers it.
- Relies on the recipient filter being a defense-in-depth optimization on top of RLS, not the sole gate — RLS is the
  real boundary, so a crafted filter can't surface a peer's alerts.
- Relies on INSERT being the only event of interest (a new alert); UPDATE/DELETE (mark-read is a service-role write
  the caller already knows about) is intentionally not subscribed.

## Residual (A36)
```json
[
  {
    "id": "NOTIF-R1",
    "item": "The live client WebSocket delivery is verified on deploy, not in the sandbox. If Realtime is disabled on the project, alerts still arrive within 60s (poll) — but not instantly.",
    "why_skipped": "No browser / authed socket in the sandbox; the poll fallback makes it fail-safe. Confirm the live push on the deployed app (open the bell as a manager, trigger a strong session, watch it appear).",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-04T03:40:00+08:00",
    "outcome": "OPEN — confirm instant delivery on prod; if Realtime is off, enable it in the Supabase dashboard."
  },
  {
    "id": "NOTIF-R2",
    "item": "On a realtime INSERT the bell re-fetches (a round-trip) rather than prepending the payload row. Simpler + consistent, but one extra request per alert.",
    "why_skipped": "Deliberate: a re-fetch avoids coupling to the realtime row shape + keeps the unread count authoritative. Alert volume is low (manager-facing), so the cost is negligible.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-04T03:40:00+08:00",
    "outcome": "OPEN — prepend from the payload if alert volume ever grows enough to matter."
  }
]
```
