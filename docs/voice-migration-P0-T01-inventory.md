# Voice migration — P0-T01 inventory (existing ElevenLabs integration)

> Read-only inventory per the build plan's P0-T01. **Decision-neutral** — documents what exists today
> regardless of the still-open repo-location decision; becomes the `DECISIONS.md` "Existing integration
> inventory" section wherever `voice-agent/` lands. Produced 2026-08-13. ElevenLabs untouched.

## Headline
**ElevenLabs handles STT + TTS only. The LLM is already yours (DeepSeek primary / Anthropic cascade) via
`/messages` / `src/lib/claude.ts`.** The plan's P0-T01 warns "don't assume ElevenLabs does all three" — it
doesn't. So the real ElevenLabs migration is an **STT + TTS swap**; the plan's "wrap the existing LLM" (P1-T03)
wraps DeepSeek, and "local LLM via vLLM" (P3-T03) is a *new alternative* to DeepSeek (separate cost/quality
decision — you already pay for DeepSeek).

## Two voice loops exist today
1. **C.A.R.E "Call Jeff"** (`src/components/care/voice/useVoiceMode.ts`, Phase 9) — customer ↔ Jeff. Browser VAD
   (AudioContext AnalyserNode, 10Hz energy) → silence → **STT → `/messages` (Jeff's brain LLM) → TTS → playback**;
   mic muted while Jeff speaks. **Turn-based HTTP through Vercel** (not WebRTC/session-length). Customer **support**.
2. **Sales coaching** (`src/lib/coach/v5/useLiveCoaching.ts`) — rep's pitch → Scribe realtime STT → cue logic →
   **TTS cue to the rep's earpiece** (`/api/coach/sales-session/tts`). Rep-facing; the AI never speaks to the
   customer. STT is browser-direct WS (satisfies the plan's D4).

**Neither is the plan's flagship** — a continuous-WebRTC door-to-door *sales* voice agent, ~8 hrs/day. That is
new architecture.

## Call-site inventory
| # | File | ElevenLabs product | Mode / transport | Models / voices | Key source |
|---|---|---|---|---|---|
| 1 | `src/lib/care/voice/elevenlabs.ts` `synthesizeSpeechStream` | **TTS** `/v1/text-to-speech/{voice}/stream` | **Streaming** (first-syllable ~75ms), `ReadableStream` | `eleven_flash_v2_5`; voice = Antoni / per-tenant `voice_id` | `ELEVENLABS_API_KEY` (env, trimmed) |
| 2 | `src/lib/care/voice/elevenlabs.ts` `transcribeSpeech` | **STT** `/v1/speech-to-text` | **Batch** (whole audio → text, request/response) | Scribe | same |
| 3 | `src/lib/care/voice/elevenlabs.ts` `transcribeWithDiarization` (via `.../upload-recording`) | **STT + diarization** | **Batch**, 2-speaker separation | Scribe diarization | same |
| 4 | `src/lib/coach/v5/useLiveCoaching.ts` + `.../realtime-token` | **STT** `wss://…/v1/speech-to-text/realtime` | **Streaming WS, browser-direct** (single-use minted token) | Scribe v2 Realtime | token minted server-side from `ELEVENLABS_API_KEY` |
| 5 | `/api/care/tts`, `/api/coach/sales-session/tts` | TTS callers of #1 | route wrappers | flash | — |
| 6 | `/api/care/stt`, `.../retranscribe` | STT callers of #2 | route wrappers | Scribe | — |
| 7 | `/api/care/agent/tenant`, `/api/coach/sales-session/voice`, `curated-client.ts`, settings pages | **config** (voice_id picker) | not a call site | curated voice list (drift-guarded) | — |
| 8 | `src/lib/env.ts` | key validation | parse-time fail-fast | `ELEVENLABS_API_KEY`, `ELEVENLABS_DEFAULT_VOICE_ID` | — |
| — | `src/lib/claude.ts` | **NOT ElevenLabs** — `medium:"voice"` is an LLM modality flag (tightens maxTokens); coach "voice" = tone | — | — | — |

## STT/LLM/TTS attribution (P0-T01 acceptance)
- **STT** = ElevenLabs — three modes: realtime WS (coaching), batch (C.A.R.E turns + retranscribe), batch+diarization (recording speaker-ID).
- **LLM** = **your own** (DeepSeek primary / Anthropic cascade via `claude.ts` / `/messages`). Not ElevenLabs.
- **TTS** = ElevenLabs streaming (flash), both loops.

## Adapter-mapping flags (P0-T01 step 5 — "what won't map cleanly onto P0-T03 ABCs")
- **Streaming TTS (#1) and realtime STT (#4) map cleanly** onto the plan's streaming-first ABCs.
- **Batch STT (#2/#3) maps awkwardly** onto the streaming `push_audio`/`results()` ABC — a batch call becomes
  "buffer the audio, emit one final `Transcript`." Works, but isn't truly streaming.
- **Diarization (#3) is NOT modeled by the plan's `Transcript` dataclass** (no speaker field). Either the STT ABC
  grows a speaker label, or diarization stays a separate batch path outside the realtime loop.
- **Barge-in / cancellation is NEW.** The plan mandates cancellation <200ms on all three ABCs so the customer can
  interrupt. Today's C.A.R.E UX does the opposite — it **mutes the mic while Jeff speaks** (feedback prevention),
  so the customer cannot interrupt. P0-T03's cancellation requirement is a new interaction model, not a wrap.

## Open questions (list, don't resolve — P0-T01 rule)
1. **Which system is the migration for** — a *new* sales voice agent, or upgrading the *existing* C.A.R.E support
   voice? (Reshapes Phases 0–2.) — **FOUNDER decision.**
2. **Same-repo vs separate `voice-agent/` repo** (governance). — **FOUNDER decision.**
3. **Diarization + BIPA (Track C):** the plan says "decide before building diarization" for Illinois BIPA
   (voiceprints = biometric). **Diarization is ALREADY built** (#3). So the real action is assessing the
   *existing* BIPA exposure of the recording speaker-ID feature with counsel — not a future build gate.
4. **Migration driver worth naming:** `persistRecording.ts` exists because *"ElevenLabs realtime STT sometimes
   captures zero turns"* (first-client incident, "sessions constantly failing to record"). STT **reliability** is
   a concrete migration motivation beyond cost/data-control, and a sharp acceptance test for any replacement STT.
5. **D4 tension:** the C.A.R.E voice routes audio **through Vercel** (`/api/care/stt|tts`), contradicting the
   plan's D4 ("audio never through Vercel"). The coaching path already satisfies D4 (browser-direct WS). Whether
   the migration keeps turn-based-HTTP for C.A.R.E or moves it to the WebRTC model is a design decision.
