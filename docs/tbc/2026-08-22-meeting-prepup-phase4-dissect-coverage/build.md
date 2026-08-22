# BUILD — Prep-up Phase 4: Dissect agenda coverage

### dissect measures the agenda
- write-path: the dissect route loads the prep (`getMeetingPrepBySession` + `getPrepDocContext`) → passes a
  `MeetingAgenda` to `generateAndStoreMeetingDissect` → `generateMeetingDissect`; the prompt renders goal + topics
  and requests an `agenda` block; `parseAgendaJudgment` extracts `goalAttained` + `note` + `covered` ids;
  `generateMeetingDissect` maps them onto the topic texts → `DissectAgenda` stored in the event payload
  (`payload.agenda`).
- read-path: `MeetingReview` renders an "Agenda coverage" section — a goal-attainment pill + note + a
  covered/missed topic checklist. The cached dissect event carries `agenda` so a re-view shows it too.

## Files
- `src/lib/coach/strategy/meeting/parseMeetingDissect.ts` — `DissectAgenda`/`GoalAttained` types + `parseAgendaJudgment`.
- `src/lib/coach/strategy/meeting/meetingDissectPrompt.ts` — render the agenda + request the judgment (both builders).
- `src/lib/coach/strategy/meeting/generateMeetingDissect.ts` — accept `agenda`, assemble `DissectAgenda`, store it.
- `src/app/api/coach/meeting-session/[id]/dissect/route.ts` — load prep + pass agenda.
- `src/components/sales-coach/MeetingReview.tsx` — the Agenda-coverage section.
- tests: `+2` in generateAndStoreMeetingDissect (coverage mapping; prep-less has no agenda).

## Reuse
Reuses the existing dissect pipeline (`dissectCoachV5`, the event-as-cache, the diarized re-transcription) + the
Phase-1 prep data layer. `parseMeetingDissect` is UNCHANGED (agenda parse is a separate focused helper). Additive:
a prep-less meeting's dissect is byte-unchanged (no agenda block).
