# CHECK - the digest can be seen to send

## Commands

```
$ npx vercel@latest logs --project team-pilot --since 8d --query weekly-digest-cron   (non-401 rows)
  09-28 13:00  200  [gamification/weekly-digest-cron] Postmark not configured (POSTMARK_SERVER_TOKEN / CARE_EMAIL_HOST_DOMAIN) … no email sent
$ (production, read-only) support_conversations by source: web_widget 63 (latest 2026-09-16)
$ npx tsc --noEmit -p .
exit 0
$ npx vitest run src/lib/care/email src/app/api/health src/lib/coach/gamification src/app/api/coach/gamification
 Test Files  23 passed (23)
      Tests  153 passed (153)
exit 0
```

The full `npm run check` is appended below.

## Findings

### A founder-requested email has never been sent, and the job reports success

class: an external-config dependency failing silently behind a 200 (CLAUDE.md §1.5.3)
sweep: every scheduled job's real runs over 26 h, and the weekly one over 8 days (Vercel logs)
severity: medium

### The "email can send" condition was written out twice

class: a restated verdict (CLAUDE.md §2.2)
sweep: grep -rn "POSTMARK_SERVER_TOKEN && process.env.CARE_EMAIL_HOST_DOMAIN" src (2, now 0 outside configured.ts)
severity: low

## Not opened

No image, icon, logo, favicon or graphic asset was touched.

```
$ MIGRATION_AUDIT_PSQL=... PGPORT=55433 ... npm run check
 Test Files  731 passed | 1 skipped (732)
      Tests  5685 passed | 15 skipped (5700)
exit 0
```
