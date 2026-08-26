# BUILD — Brief scheduling (day/week + overnight pre-generation)

### day/week window
- write-path: `teamTrainingBrief.ts` — `generateTeamTrainingBrief(companyId, periodDays=7)` parameterizes the cutoff;
  `labelForDays(days)` gives the human label (1 → "the last day"). Route maps {period:"day"|"week"} → 1/7.
- read-path: the panel's Day/Week toggle drives the window the next Build looks over; the label reflects it.

### cache (append-only event, §3.1)
- write-path: `storeTeamBrief` appends `coach.team_brief_generated` ({result, period_days}) — only for an `ok` brief.
  `getLatestTeamBrief` reads the newest for a company (null-guards a bad payload).
- read-path: the panel GETs the cached brief on mount → opens ready, with a "generated at" note.

### overnight pre-generation + cron
- write-path: `runTeamBriefPregeneration` (sequential, capped) generates + caches the WEEK brief for each company with
  coaching activity in the window. `team-brief-cron` (GET, CRON_SECRET-gated, maxDuration 300) runs it; registered in
  vercel.json at 06:00 daily.
- read-path: managers open to a ready brief each morning; the manual POST also caches so a reload shows the fresh one.

### A30 guard
- write-path: `teamTrainingBrief.test.ts` — labelForDays (day vs N-days), +2 tests.
- read-path: a regression from "the last day" back to "the last 1 days" fails a test.

## Files
- `src/lib/coach/v5/teamTrainingBrief.ts` — periodDays param + labelForDays + store/getLatest/pregeneration.
- `src/lib/coach/v5/__tests__/teamTrainingBrief.test.ts` — +2 label tests.
- `src/app/api/coach/sales-session/team-brief-cron/route.ts` — CRON_SECRET-gated pre-generation cron.
- `src/app/api/coach/sales-session/team-training-brief/route.ts` — GET (cached) + POST accepts period + caches.
- `src/components/sales-coach/TeamTrainingBriefPanel.tsx` — Day/Week toggle + load-cached-on-mount + ready note.
- `vercel.json` — the team-brief-cron registration (06:00 daily).

## Ripple (§6 item 5)
No schema/table (reuse events). New cron + a vercel.json entry + engine functions + a GET + a panel toggle. The brief
generation/honesty seams are unchanged; the shared panel keeps Coach Assessment + Training in sync.

## Honest limit
Pre-generation caches the WEEK brief (the meeting default); a manager wanting the day view clicks Build (still cached).
The cron is sequential + capped (10 companies/run) so a larger deployment drains over nightly runs — surfaced, not silent.
