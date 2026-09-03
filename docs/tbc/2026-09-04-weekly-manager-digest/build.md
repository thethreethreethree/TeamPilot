# BUILD — Weekly manager digest

### The generic sender
- write-path: `src/lib/care/email/outbound.ts` — added `sendTransactionalEmail({to, subject, htmlBody, textBody})`:
  a generic Postmark send (HTML + text) reusing the same token/domain + `formatEmailAddress`/`sanitizeEmailHeaderValue`.
- read-path: any product email (the digest) sends through it; it returns `{ok:false, error}` (fail-loud) when Postmark
  isn't configured, so a caller logs/counts instead of silently dropping mail.

### The digest content + template (pure)
- write-path: `src/lib/coach/gamification/weeklyDigest.ts` — `summarizeTeamWeek(rows, soldAgentIds)` folds a week of
  ledger rows + sold sessions into a per-team summary (points / strong / deals + top performers); `renderManagerDigestEmail`
  returns subject + inline-styled light HTML + a text fallback (rep names HTML-escaped).
- read-path: the orchestrator renders one email per company; a manager opens a light, on-brand email with the team's
  totals, the medaled top performers, and a Scoreboard CTA.

### The orchestrator + cron
- write-path: `runWeeklyManagerDigest` (weeklyDigest.ts) iterates companies with points activity in the last 7 days,
  summarizes each, resolves managers (`isAdminRole || sales_coach_role='admin'`) + their emails
  (`admin.auth.admin.getUserById`), and sends — injectable `send`/`now`/`admin` for tests. Cron
  `src/app/api/coach/gamification/weekly-digest-cron/route.ts` (GET, CRON_SECRET via constantTimeEqual, maxDuration
  300) calls it; `vercel.json` registers it (Mon 13:00 UTC).
- read-path: every Monday the scheduler hits the cron → each active company's managers receive the digest; a manual
  browser hit bounces off the CRON_SECRET gate.

## Files
- `src/lib/care/email/outbound.ts` (added sendTransactionalEmail)
- `src/lib/coach/gamification/weeklyDigest.ts` (NEW) + `__tests__/weeklyDigest.test.ts` (NEW, 8 tests)
- `src/app/api/coach/gamification/weekly-digest-cron/route.ts` (NEW) + `__tests__/route.test.ts` (NEW, 4 tests)
- `vercel.json` (cron entry), `.env.example` (APP_BASE_URL documented)

## Ripple (§6 item 5)
- New cron registered in vercel.json (the invariant audit fails an unregistered cron — now 0 violations).
- Server-only module (`import "server-only"`); the base URL is `APP_BASE_URL` (NOT NEXT_PUBLIC_ — the invariant
  flagged the first draft's NEXT_PUBLIC_ var; fixed + documented).
- Reuses the ledger + sold-sessions source, so the digest numbers agree with the board; no new aggregate authority
  to drift (the strong threshold + admin predicate are imported, not re-derived).
