# BUILD — View session: show rep usage/activity

### rep-activity (the usage view for one rep)
- write-path: `rep-activity/route.ts` — a rep's sessions over 30 days, `.eq(company_id).eq(agent_id).gte(started_at)`,
  NO audio filter; returns {id, clientLabel, status, startedAt, hasAudio, saved} + totalCount + lastActiveAt. Same
  manager+same-company authz as `/recordings` (isSalesCoachManager + canManagerViewRepSkills). Guards the missing
  recording_saved column (0187) like `/recordings`.
- read-path: the manager opens a rep → sees ALL their recent sessions, with a recording tag where audio exists.

### team-activity (roster usage at a glance)
- write-path: `team-activity/route.ts` — one company-scoped read of the last 30 days, aggregated by agent_id in code →
  {byAgent: {[id]: {count, lastActiveAt, withAudio}}}. Manager-gated.
- read-path: the roster shows "N sessions · last active X" per rep.

### the manager view
- write-path: `StandardSessionsManagerView.tsx` — roster fetches team-activity + shows per-rep usage; `RepActivity`
  (was `RepRecordings`) fetches rep-activity + lists sessions (date · status · recording/no-recording), Save toggle only
  where audio exists, each linking to the session detail. The old audio+2-day `/recordings` endpoint is untouched.
- read-path: active reps whose sessions have no audio now appear with their real usage.

## Files
- `src/app/api/coach/sales-session/rep-activity/route.ts` — per-rep sessions (usage), any audio, 30 days.
- `src/app/api/coach/sales-session/team-activity/route.ts` — per-rep usage summary for the roster.
- `src/components/sales-coach/StandardSessionsManagerView.tsx` — roster usage + RepActivity view.
- `scripts/diag-view-session.mjs` — the read-only diagnostic (kept as a tool).

## Verified against real prod data
`scripts/diag-view-session.mjs`: Knute Knudtson 0 recordings in the old view → 44 sessions in the new rep-activity view;
team-activity surfaces Knute (44) / Anthony (53) / John (9) with last-active dates. The exact reps the founder reported.

## Ripple (§6 item 5)
Two new READ-ONLY routes + a manager-view rewrite. `/recordings`, save-recording, and the rep self-view are unchanged.
No schema. §A18: activity, unsorted. §3.4: honest empty vs error.

## Flag to founder (not silently fixed)
Alejandro Salazar is in company "ASP" (b2feb3b2), not "Align Sales Pros" (28203036), with 0 sessions — a data/setup
issue (move him / re-add him to Align Sales Pros). Moving a user between companies is a founder decision, so surfaced.
