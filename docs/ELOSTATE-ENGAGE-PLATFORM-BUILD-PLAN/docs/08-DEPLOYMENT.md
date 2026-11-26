# 08 — Deployment

- Vercel; `db:apply`.
- **External preconditions (§1.5.3), each with a visible off state:**
  - automatic email needs `POSTMARK_SERVER_TOKEN` + `CARE_EMAIL_HOST_DOMAIN` (unset in production; `emailConfigured()`);
  - the dialer needs a Twilio account;
  - agents on a schedule (close date near) need a cron with `CRON_SECRET` (unset).

  Agents on events (a stage change) run when the event happens and need no cron.
