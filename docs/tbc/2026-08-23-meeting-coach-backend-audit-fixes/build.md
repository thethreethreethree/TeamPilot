# BUILD — Meeting Coach backend/wiring audit fixes

### the review self-heals from live chunks (INT-1)
- write-path: the dissect route, when `session.audioAssetUrl` is null, calls `stitchSessionAudio({companyId,id})`
  (idempotent, service-role) to assemble the live 15s chunks + stamp the pointer, then re-reads it.
- read-path: a clean-Stop-failed-persist meeting is now reviewable (the stitch runs on first view) instead of a
  409 that never resolves; a truly unrecorded meeting still gets the honest 409 (stitch no-ops on "no chunks").

### the prep link is honest (INT-3)
- write-path: `markMeetingPrepStarted` does `.update(...).select("id")` and returns `(rows>0)` — false on a 0-row
  no-op (stale/foreign prepId) or an error; the create route logs a no-op and returns `prepLinked` in its response.
- read-path: a silent "prep loaded" over an unlinked prep is now observable (server log + the returned flag).

### error-as-no-data honesty (BE)
- write-path: `getMeetingPrep` + `listPrepDocuments` THROW on a genuine DB error (null/[] reserved for a real
  no-row); the GET route try/catches → 500 "try again" (not a false 404); the brain-side reads
  (`getMeetingPrepBySession`, `getPrepDocContext`) LOG-and-degrade rather than silently swallow.
- read-path: a transient read failure tells the user "try again", not "your prep is gone"; the cue path degrades
  to agenda-less coaching but the failure is logged, not invisible.

### coverage accumulates + is respected (INT-2)
- write-path: Prep-up topic ids are now short (`t`+5 base36) — the coach LLM echoes them reliably in `covered`;
  the dissect ORs-in the live-accumulated `t.covered` instead of recomputing purely from its own echo.
- read-path: a discussed topic is marked covered (the coach stops re-nudging it; the review shows it covered),
  even if the dissect LLM later drops the id.

## Files
- `src/app/api/coach/meeting-session/[id]/dissect/route.ts` — stitch-on-demand (INT-1).
- `src/lib/data/meetingPrep.ts` — markMeetingPrepStarted rows-check; getMeetingPrep/listPrepDocuments throw;
  brain-side reads log-and-degrade; honest header.
- `src/app/api/coach/meeting-session/route.ts` — surface/log the prep-link result (INT-3).
- `src/app/api/coach/meeting-prep/[id]/route.ts` — GET try/catch → honest 500 vs 404.
- `src/lib/coach/strategy/meeting/generateMeetingDissect.ts` — OR-in live coverage (INT-2).
- `src/components/sales-coach/meeting/MeetingPrepUp.tsx` — short topic ids (INT-2).
- tests: `meetingPrep.honesty.test.ts` (+5).

## Ripple (holistic)
No schema change (INT-1 reuses the existing chunk layout + stitch; short ids are additive — old UUID-id preps still
work, the OR-in covers both). All 16 meeting test files (101) pass unchanged. INT-4 / doc-upload hardening / the
coverage race / multi-company LOWs are flagged in the residual (single-company-safe today).
