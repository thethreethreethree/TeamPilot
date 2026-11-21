# BUILD - RSS Phase 9: reach

Migration 0286. New env: RSS_WEBHOOK_SIGNING_SECRET, NEXT_PUBLIC_AUTH_PROVIDERS (both documented in .env.example).

### Signed webhooks
write-path: coaching_sessions status → 'ended' / outcome → 'sold' and pitch_scores insert → triggers →
rss_webhook_enqueue → webhook_deliveries (one per active subscribed endpoint; ids, times, outcome, value, score; never
transcript or client label). Sender: /api/coach/remote/webhooks/send-cron every 5 min (vercel.json) →
rss_webhook_due (backoff 1-16 min, 6 tries, 3 days) → sendSigned with the endpoint's derived secret → webhook_attempts.
Admins: /api/coach/remote/webhooks add (assertEndpointUrl) / off / secret / test, with audit rows.
read-path: Settings → Protection → Webhooks lists endpoints with the last attempt; "Send a test" shows the receiver's
answer; "Show signing secret" shows that endpoint's secret and how to verify.

### CSV team import
write-path: Team page → Import a team from a CSV → POST /api/team/import (admins): preview, then apply → invitations
through createInvitation (the same function POST /api/team now calls) and manager_id for existing members after
assertValidManager over the whole tree.
read-path: the Team page reloads its members and pending invitations (with their links); the import shows each row's
result.

### Google and Microsoft sign-in
write-path: OAuthButtons (only providers listed in NEXT_PUBLIC_AUTH_PROVIDERS) → Supabase signInWithOAuth →
/auth/callback exchanges the code for the session cookie.
read-path: the person lands on the safe `next` page (same-site only) on the canonical origin; a failure lands on
/login with a fixed sentence chosen by code.
