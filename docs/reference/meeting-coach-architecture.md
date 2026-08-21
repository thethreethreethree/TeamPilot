# Meeting Coach (Team-Sync) — architecture reference

> Written 2026-08-22 after building the in-person MVP (commits `129e3c01` server, `4f5c4538` client,
> `9eda105a` hardening, `6fe34caa` audio). The feature spans server + client + REUSED sales infrastructure in
> non-obvious ways (several "sales-session"-named routes are used by meetings). This maps the whole thing so the
> next maintainer doesn't re-derive it. Governing plan: `docs/MeetingCoach-BuildPlan.md`.

## The one-line shape

**Reuse the engine, rewrite the brain.** A meeting session IS a `coaching_sessions` row (with `session_kind`),
so it reuses the sales transport routes, storage, and crons. What's new is the *coaching intelligence* (the
meeting/huddle brains) and a *separate live-capture client* — because the sales client's transport is welded to
its 2-party attribution, which is wrong for an N-party meeting.

## The two brains vs the engine

| | REUSED (sales infra, untouched) | NEW (meeting-specific) |
|---|---|---|
| Strategy | `selectStrategy`, the `CoachingStrategy` seam | `meeting/` + `huddle/` brains (`src/lib/coach/strategy/`) |
| LLM binding | `call()` provider cascade | `liveMeetingCue` (claude.ts) — mirrors `liveSalesCue`, `controlExempt` |
| Transport routes | `/realtime-token`, `/tts`, `/audio-chunk`, `/upload-recording/*` | — |
| Storage + crons | `stitchSessionAudio`, auto-close-stale + recording-purge crons | — |
| Session row | `coaching_sessions`, `coaching_cues`, `createSession`, `getSession`, `appendCue` | `session_kind` column (0237); meeting create route |
| Client | — | `useMeetingCoaching` + `MeetingCoachingPanel` (NOT the sales hook) |

## Why a SEPARATE client hook (not a parameterized sales hook)

`useLiveCoaching.ts`'s transport (mic + Scribe WS + audio graph + reconnect) is INLINE and intertwined with its
2-party loudness attribution (`volumeVerdict`, `pitchSeparation`) — no clean seam to reuse (the plan's Phase-2
"no clean seam → changes effort" case). Parameterizing it in place would risk the live sales business. So
`useMeetingCoaching` is a lean, self-contained transport with ZERO changes to the sales hook. Cost: a duplicated
~10-line PCM encoder + WS const (shareable later once both are stable).

## Server flow

1. **Create** — `POST /api/coach/meeting-session` (owner + company scoped) → `createSession({ sessionKind })`.
   A34 write-safety: `session_kind` is written to the INSERT **only** for meeting/huddle — the sales path omits
   it, so it's byte-identical + safe on a pre-0237 DB. A meeting create fails honestly (500) if 0237 is unapplied.
2. **Cue** — `POST /api/coach/meeting-session/[id]/cue` (owner-gated) resolves `session_kind → CoachingMode`
   (`resolveCoachingMode`, safe-defaults `sales`, 400s a sales session), runs `selectStrategy(mode,{cueLLM})`
   with `liveMeetingCue` bound to the company, over the N-party `liveTranscript`. Persists a delivered cue via
   `appendCue`, mapping the mode through `toCoachingCuesMode` (`directive→guide_response` — the coaching_cues
   CHECK landmine) + `latency_ms`.

## Client flow (`useMeetingCoaching`)

- mic → Scribe v2 realtime STT (single-use `/realtime-token`) → **UNLABELED** committed turns (speaker
  "participant"). A single room mic can't reliably split speakers, so per A39 turns are unlabeled rather than
  guessed — the text monitors work; the imbalance monitor stays silent until diarization.
- On each committed turn (auto-coach) or a "coach me now" tap: POST the cue route → speak the cue to the earpiece
  via `/tts`.
- **Reconnect**: `teardownTransport` (frees socket + audio graph + context, KEEPS the mic stream) runs before a
  reconnect rebuilds — else each drop leaks an AudioContext (browsers cap them).
- **Audio durability** (the sales "audio is load-bearing" lesson): a `MediaRecorder` (15s slices) uploads each
  chunk to the shared `/audio-chunk` route AND, on clean Stop, persists the full blob via `persistRecording`. A
  never-Stopped meeting is stitched from the chunks by the auto-close-stale cron. Recorder created on FRESH start
  only (one webm, no seam) — post-mic-track-loss audio isn't recorded (documented MVP limit).

## Reuse points VERIFIED session-generic (2026-08-22)

These sales-named routes/crons carry NO `session_kind` filter, so meetings genuinely reuse them (confirmed by
reading them — a future sales-specific filter would silently break meeting audio, so treat as a drift risk):
- `/audio-chunk` route — owner-gated on the session, no kind check.
- auto-close-stale cron — queries `coaching_sessions` by status+age only; stitches company-pinned.
- `upload-recording/sign` (via `persistRecording`) — `getSession` + owner/manager, no kind check.

Cosmetic: the reused routes' error text says "rep" — reads slightly off for a meeting facilitator, but functional.

## Not persisted: the live meeting transcript

Unlike sales (which flushes `/segments`), the meeting live transcript is client-only cue-fuel. The durable AUDIO
is the source of truth: post-meeting Dissect (Phase 6) will re-transcribe it with BATCH diarization
(`autoSpeakerAssign` clusters) for full N-party attribution — higher quality than the unlabeled live stream.

## Open / deferred

Apply migration 0237 + founder device validation; nav + module gating (product-structure decision — under Sales
Coach or its own Team-Sync section?); realtime diarization (needs verifying Scribe realtime support — A41);
video/platform captions (major external OAuth integration); post-meeting Dissect (needs the §3.5 measurement
decision — what a "good meeting" measures; the durable audio is its input).

## Tests

Server logic is tested; the hook + panel are mic/WS/AudioContext React glue — device-confirmed, not unit-tested
(same standing limit as `useLiveCoaching`). See `resolveCoachingMode.test.ts`, `persistCueMode.test.ts`, the
meeting-session cue + create route tests, `salesCoach.createSessionKind.test.ts`, and the strategy-core tests.
