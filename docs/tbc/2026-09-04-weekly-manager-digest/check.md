# CHECK — Weekly manager digest

## Typecheck — `npm run typecheck`
```
> tsc --noEmit
exit: 0
```

## Digest + cron tests — `npx vitest run .../weeklyDigest.test.ts .../weekly-digest-cron/__tests__/route.test.ts`
```
 Test Files  2 passed (2)
      Tests  12 passed (12)
exit: 0
```
Coverage (12-of-12): summarizeTeamWeek — per-agent points/sessions/strong aggregation, deals folded in (a deal-only
rep still appears), top-N ranking by points then strong, empty→zeros; renderManagerDigestEmail — subject names the
company+week, HTML carries the top performers/stats/board link, text fallback, and a rep name is HTML-escaped (no
injection); the cron — 503 without CRON_SECRET, 401 on a wrong/absent Bearer, runs + returns the result when armed.

## Invariant audit — `npm run invariant:audit`
```
Violations:           0
✓ ... every cron route registered in vercel.json (no silently-dead cron) ...
```
The new cron is registered; no NEXT_PUBLIC_ secret leak (the server-only base URL is APP_BASE_URL, documented in
.env.example — the env-doc completeness guard passes).

## Visual — the rendered email (read by eye)
Rendered `renderManagerDigestEmail` for a sample team at 620px and read it: a dark ELOSTATE header, three ember stat
tiles (Points / Strong sessions / Deals), a medaled top-performers list (🥇🥈🥉 + per-rep pts·strong·deals), an ember
"Open the Scoreboard →" CTA, and the active-reps footer. Clean, on-brand, light-background (email-safe).

## Not claimed (§1.5.3)
- The live Postmark SEND is not exercised here (the sandbox can't send mail); the run returns emailConfigured +
  warns when Postmark is missing, and live delivery is confirmed on deploy. C.A.R.E email is already live, so
  Postmark is likely configured; if not, the run sends nothing loudly rather than erroring.
- Full `npm run check` runs at pre-commit + on merge.

## Findings
- No findings / no defects. The first draft used a NEXT_PUBLIC_ base URL (client-bundle risk) — the invariant caught
  it, and it was changed to a server-only APP_BASE_URL + documented before commit.
