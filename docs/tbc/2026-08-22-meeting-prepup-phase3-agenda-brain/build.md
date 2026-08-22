# BUILD — Prep-up Phase 3: the agenda-aware brain

### agenda into the brain
- write-path: `CoachingContext.agenda` (new) carries `MeetingAgenda {goal, topics[{id,text,covered}], docContext}`;
  `MeetingStrategy.analyze` passes it to `buildMeetingCueUserMessage`, which renders the agenda block; the system
  prompt gains the `uncovered_topic` trigger + agenda instructions + the `covered` output field.
- read-path: the brain hints the next NOT-COVERED topic, grounds drift in the goal, and near the end raises a
  still-uncovered must-discuss topic ("uncovered_topic", high importance).

### coverage (one call, single-source parse)
- write-path: `parseCueDecision` parses `covered` → `CueDecision.coveredTopicIds` (independent of `shouldCue`).
  The cue route merges those into the prep's `topics[].covered` via `setMeetingPrepTopicsCovered` (accumulates;
  no write when unchanged).
- read-path: the accumulated coverage feeds the next window's agenda render (covered topics aren't re-nudged).

### cue route
- write-path: loads `getMeetingPrepBySession(id)` + `getPrepDocContext(prep.id)` → builds the agenda → passes it
  in `context.agenda`; after analyze, persists coverage. Best-effort (a prep-load failure never blocks the cue).
- read-path: n/a (the live client renders the returned cue as today).

## Files
- `src/lib/coach/strategy/coachingStrategy.ts` — `MeetingAgenda` type; `CueDecision.coveredTopicIds`; `CoachingContext.agenda`.
- `src/lib/coach/strategy/parseCueDecision.ts` — parse `covered`.
- `src/lib/coach/strategy/meeting/meetingCuePrompt.ts` — `uncovered_topic` trigger + agenda render + `covered` output.
- `src/lib/coach/strategy/meeting/meetingStrategy.ts` — pass `agenda`.
- `src/lib/data/meetingPrep.ts` — `getPrepDocContext`.
- `src/app/api/coach/meeting-session/[id]/cue/route.ts` — load prep + agenda + persist coverage.
- tests: `meeting/__tests__/agendaBrain.test.ts` (new) + cue route `+2` agenda tests + cue test mock update.

## Reuse
Reuses the shared `parseCueDecision` chokepoint (coverage parsed once, §2.2), the existing meeting brain/route,
and the Phase-1 data layer. Additive: non-agenda strategies (sales/huddle) + prep-less meetings are unchanged.
