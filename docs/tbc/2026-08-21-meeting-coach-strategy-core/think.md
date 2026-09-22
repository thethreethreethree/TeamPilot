# THINK — Meeting Coach strategy core (reuse the engine, rewrite the brain)

**Trigger:** Founder, 2026-08-21: "start on `docs/MeetingCoach-BuildPlan.md`" + "modify the meeting
features/functionality to accommodate for the <Team-Sync> team meeting system." Team-Sync is the umbrella
feature; Meeting Coach is a sub-system. Founder confirmed: re-aim the existing Sales Coach, do NOT build
Team-Sync from scratch first.

## Understanding (§0 + Phase-1 map)

The Sales Coach's LIVE in-ear loop is fully built (mic→Scribe STT→cue trigger→`generateLiveCue`→`/tts`→earpiece)
but UNTESTED on hardware; see `docs/SALESCOACH-REUSE-MAP.md`. The plan's discipline: **reuse the engine, rewrite
the brain.** The context-agnostic transport (audio/STT/upload/stitch/reconnect/persist/TTS) is reused; what is
sales-specific (the coaching prompts + "what a good move is") is re-aimed to facilitation. Two reuse-map flags:
(1) the delivery path is unproven on device; (2) the capture/ATTRIBUTION layer is built for 1-agent-vs-1-prospect
(2-party, loudness heuristics) — a meeting is N-party, so attribution is newly-written, gated on founder
**Decision #1** (capture method).

The natural seam is `generateLiveCue` (liveCue.ts:119): transcript window + context → a single cue decision.
No interface abstracts it today (sales is hard-wired at the client hook, the `/cue` route, and the engine).

## Design (this build — the PURE CORE, everything unwired/zero-prod-impact)

1. **`CoachingStrategy` seam** (`coachingStrategy.ts`): `analyze(segments, context) → CueDecision`, generalized
   from the real `generateLiveCue` signature. Speaker is a string (N-party). `phase`/`trigger` are
   strategy-defined strings. Hints ride an open `signals` bag. `CueLLM` is the dependency-injected LLM call, so
   a strategy carries NO binding/model/control-gate decision (deferred to wire time).
2. **`SalesStrategy`** (`salesStrategy.ts`): the existing sales brain as a CoachingStrategy over UNCHANGED
   `generateLiveCue` — proves the seam fits the shipped engine (Phase-2 step-2, as a proposal; not wired).
3. **Shared parse** (`parseCueDecision.ts`, §2.2 single-source): silent-safe; out-of-vocab trigger → none
   (blocks a cross-domain cue leak). `parseMeetingCue`/`parseHuddleCue` pin it to their vocab.
4. **Meeting brain** (`meeting/`): facilitation prompt (§3.1 triggers) + strategy class. §3.4-honest — omitted
   triggers a transcript can't ground (agenda-timing; roster-based missing-update); `imbalance` degrades to
   silent when unattributed (robust to Decision #1).
5. **Huddle brain** (`huddle/`): same shape, tighter (near-silent, §3.2 triggers, shorter window).

## Why safe / additive
Every file is NEW and imported by nothing in the live path; the Sales Coach is byte-for-byte unchanged (the
seam is a PROPOSAL, not wired). The only edits to existing files are comment corrections (stale "audio I/O not
built"). Zero production behavior change; full typecheck + 35 unit tests are the proof.

## Held for founder (NOT guessed — §5/§3.3)
- The concrete `CueLLM` (a `liveMeetingCue` in claude.ts) — control-month gate? model? `controlExempt`?
- Live wiring (engine selects+calls a strategy, delivers via `/tts`) + the `coaching_sessions` mode migration.
- **Decision #1** — capture/attribution method.
