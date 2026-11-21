# BUILD - RSS Phase 4

## Migrations
- 0278_rss_p4_coaching.sql — feedback_requests (nullable recipient), listen_events; select-only RLS (owner /
  recipient / manager under rss_tree_allows); append-only rules; no client writes.
- 0279_notify_feedback_requested.sql — manager_notifications type 'feedback_requested' (drop-then-add, as 0263).

## Library
- src/lib/coach/remote/feedback.ts — gongRules, allManagerActions, closesUnderEveryPolicy, countsAsFeedback
  (throws until D8), isRequestOpen, listenedSeconds, counted (throws until D8), parseListenRange,
  loadCoachingEvents (company-pinned reads of comments, overrides, dispute answers).
- src/lib/coach/gamification/notify.ts — notifyFeedbackRequested (named manager, else resolveManagers).

## Routes
- GET/POST /api/coach/remote/[id]/feedback-request — rep's own finished phone/video call; one open at a time.
- POST /api/coach/remote/[id]/listen — range from the player; listener from auth.
- GET /api/coach/remote/coaching-inbox — manager; treeFilterReps; derived status; "you played".
- GET /api/coach/remote/coaching-metrics — 409 naming D8 until decided; computes per-manager counts after.

## Screens
- RemoteCallPanel — sends played stretches on pause / seek / end / leaving.
- FeedbackRequest (session page, rep only) — request with note; open / answered states in words.
- CoachingInbox (Coach Assessment, above disputes) — columns Rep · Call · Asked · Note · Status · You played;
  filters Open only / To you; D8 line for metrics.
- NotificationBell — 'feedback_requested' branch (lands on the session page).

## Gates written to
- rls-audit allowlist: feedback_requests.*, listen_events.* write ops with reasons.
- INV29 every service-role statement names company_id; INV36 inbox/metrics call treeFilterReps; INV26 Bearer
  routes use callerScopedDb(req) ?? createClient(); INV14 no raw message at 5xx.

## Tests
- src/lib/coach/remote/__tests__/feedback.test.ts; route tests for feedback-request, listen, coaching-inbox,
  coaching-metrics.
