# BUILD — Meeting Coach strategy core

All under `src/lib/coach/strategy/` (NEW; nothing wired into the live engine).

## Seam + shared
- `coachingStrategy.ts` — `CoachingStrategy` interface, `StrategyTranscriptSegment`, `CoachingContext`
  (carries `companyId` + optional `wearerId` — found missing when the sales adapter couldn't ground a cue
  without them), `CueDecision`, `CueMode` (`suggestion`|`directive`), `CueImportance`, and `CueLLM` (the
  injected LLM call).
- `parseCueDecision.ts` — shared, pure, total parse (§2.2). Silent-safe on malformed/unparseable/out-of-vocab
  (§5/§3.4). Out-of-vocab trigger/phase → none/unknown (blocks cross-domain cue leak). Honors `force` + the
  empty-cue-is-not-a-cue understanding gate.

## Sales adapter (Phase-2 step-2 proof, unwired)
- `salesStrategy.ts` — `SalesStrategy implements CoachingStrategy`, a pure adapter over UNCHANGED
  `generateLiveCue`. Maps generalized inputs → the real sales arg names (`stall`→`stalled`,
  `directive`→`guide_response`, `wearerId`→`agentId`, `sessionKind`→`context`, `signals.*`→typed hints, with
  both `stress` and `confidence` VALIDATED — a malformed hint → undefined, never a guessed signal).

## Meeting brain (Phase 3)
- `meeting/meetingCuePrompt.ts` — `MEETING_PHASES`, `MEETING_TRIGGERS`
  (`drift|undecided|unassigned_action|unclear|imbalance|summarize`), `buildMeetingCueSystemPrompt` (+ shared
  anti-injection fence appended), `buildMeetingCueUserMessage`.
- `meeting/parseMeetingCue.ts` — pins the shared parse to the meeting vocab.
- `meeting/meetingStrategy.ts` — `MeetingStrategy` class: understanding gate (MIN_SEGMENTS) → rolling window
  (14) → prompt → injected `CueLLM` → honor `suppressed` verdict (A40) → parse. Never throws.

## Huddle brain (Phase 4)
- `huddle/huddleCuePrompt.ts` — `HUDDLE_PHASES`, `HUDDLE_TRIGGERS`
  (`vague_status|hidden_blocker|overrun|capture_action`), tighter/near-silent prompt.
- `huddle/parseHuddleCue.ts` + `huddle/huddleStrategy.ts` — as meeting, tighter window (10).

## Existing-file edits (comment-only)
- `src/app/api/coach/sales-session/[id]/cue/route.ts` + `src/lib/coach/v5/liveCue.ts` — corrected the stale
  "audio I/O … not built" comments (the live loop IS built; the map traced it). No behavior change.

## Docs
- `docs/SALESCOACH-REUSE-MAP.md`, `docs/MEETINGCOACH-CONFIG-PRECONDITIONS.md`.
