# BUILD — Meeting Coach brain: 3rd-review fixes + session-lifecycle end route

### Finding A — forced cue re-throws
- write-path: `MeetingStrategy`/`HuddleStrategy.analyze()` catch now does
  `if (context.force) throw e instanceof Error ? e : new Error(String(e)); return SILENT;`.
- read-path: the wire-time route surfaces a forced-cue throw as a 502 (honest error), while an AUTO cue failure
  still resolves to a stay-silent `CueDecision` — no live-meeting disruption. Contract stated in `coachingStrategy.ts`.

### Finding B — out-of-vocab / leaked trigger dropped from AUTO cues
- write-path: `parseCueDecision` — `shouldCue = opts.force ? cue.length>0 : o.shouldCue===true && cue.length>0 && trigger!=="none"`.
- read-path: a model reply carrying a foreign trigger (e.g. sales `close`) normalizes to `trigger:"none"` and is
  returned as a non-cue (`shouldCue:false`), so a closing cue can never surface in a meeting/huddle.

### Findings C + D — attribution boundary hardened (A39)
- write-path: `renderTurns` adds `cleanSpeaker(s) = oneLine(s ?? "").replace(/:/g,"").trim()`; `speakerLabel`
  folds newlines + strips colons + maps blank/`unknown` → `UNKNOWN`; `distinctKnownSpeakers` trims via
  `cleanSpeaker` before the known check.
- read-path: the built cue user message renders `SPEAKER: text` on one line per turn with no forgeable line from
  either field; the `imbalance` suppression gate counts only genuinely-known speakers.

### Session-lifecycle — end route (new, additive)
- write-path: `POST /api/coach/meeting-session/[id]/end` → owner-gated; 400 for a sales session; no-op if not
  `active`; else `setSessionStatus({sessionId, status:"ended", actorId})` stamps `ended_at ≈ now`.
- read-path: `MeetingCoachingPanel.endSession()` fires `void fetch(.../end, {method:"POST"})` on Stop, so meeting
  DURATION (started..ended) is real instead of the ~6h the 6h-stale cron + 0070 trigger would produce.

## Files
- `src/lib/coach/strategy/parseCueDecision.ts` — leak gate (Finding B).
- `src/lib/coach/strategy/renderTurns.ts` — `cleanSpeaker` + label/known-speaker defense (Findings C+D).
- `src/lib/coach/strategy/meeting/meetingStrategy.ts`, `.../huddle/huddleStrategy.ts` — force re-throw (Finding A).
- `src/lib/coach/strategy/coachingStrategy.ts` — auto-vs-forced throw contract comment.
- `src/lib/coach/strategy/__tests__/strategyClasses.test.ts` — +force-re-throw, +leaked-trigger-dropped.
- `src/lib/coach/strategy/__tests__/userMessageAttribution.test.ts` — +label-forge, +helper (C+D) tests.
- `src/lib/coach/strategy/meeting/__tests__/generateAndStoreMeetingDissect.test.ts` — +stored-payload `balance` assertion.
- `src/app/api/coach/meeting-session/[id]/end/route.ts` (+ `__tests__/route.test.ts`) — NEW end route (6 tests).
- `src/components/sales-coach/MeetingCoachingPanel.tsx` — end wiring on Stop.

## Reuse
Fixes A/B mirror the sales `generateLiveCue` force-re-throw + vocab-gate patterns; the end route reuses
`getSession`/`setSessionStatus`/`resolveCoachingMode`. No sales-scoring or live-engine change — the strategy
core is still UNWIRED; the end route is additive.
