# Live Sales Coach — Capture Crisis Audit & Remediation (2026-08-21)

Founder escalation: *"our biggest problem right now is the session dropping all the time, recording stopping
randomly, and pitch/after pitch not generating… it is also not being recorded/saved to our system properly."*

This is the on-record audit (§1.7 ground-up, §1.2 retrospective) and the remediation shipped in response.

## 1. The record (what actually happened)

`scripts/diag-session-health.mjs` — read-only, 243 sessions over 21 days:

| Metric | Value |
|---|---|
| Captured ZERO transcript | 54% |
| Saved NO audio (`audio_asset_url` null) | 93% |
| Generated no after-pitch/dissect | 78% |
| FULL result (both speakers + review) | ~15% |

**The decisive signal — capture dies on long calls:**

| Call length | Captured nothing | Full result |
|---|---|---|
| < 2 min | 22% | 33% |
| 2–5 min | 8% | 30% |
| 5–15 min | 24% | 22% |
| **> 15 min** | **79%** | **8%** |

146 of 243 sessions (60%) ran > 15 min, and 79% of those captured nothing. The last 3 days were no better,
confirming the earlier fixes (incremental flush, first reconnect attempt) had not solved it.

## 2. Root causes (three parallel code traces + the data)

The four founder symptoms reduce to **capture failing on long calls**; the generation failures are downstream
(you cannot generate an after-pitch from an empty transcript).

1. **Sessions dropping (A).** The single-use ElevenLabs realtime token expires ~15 min into a call, so the STT
   socket drops on every long call. Reconnect was *supposed* to recover it, but (i) a transient failure *during*
   a reconnect (e.g. the token endpoint 503s under load) hit `start()`'s catch → `stop()` → `stoppedRef=true`
   → **no further reconnect ever** ("drops and stays dropped"); (ii) there is no WS keepalive, so silence /
   backgrounding lets the provider idle-close; (iii) exhausted reconnects went silently to `idle`.

2. **Recording stopping mid-call (B) — a regression I shipped 2026-08-21.** The reconnect path called
   `teardownMedia()`, which **stopped the MediaRecorder + mic and discarded the captured audio on every drop**;
   `start()` then re-acquired the mic (which fails on a backgrounded/locked phone → permanent end). The
   transcript was preserved across reconnect but the audio was thrown away. (Fixed in P0.)

   **CORRECTION (per-day data, §5):** I originally attributed the ~93% no-audio rate mainly to this regression.
   That was IMPRECISE. The per-day trend (`diag-session-health.mjs`) shows `noAudio` ~97–100% on EVERY day back
   to early August — long before the 08-21 regression. The dominant cause is separate and older: `persistRecording`
   (the "never lose the audio" guarantee, `LiveCoachingPanel.tsx:120-146`) fires only on a CLEAN Stop, but most
   sessions are never cleanly Stopped (rep closes the tab → the component unmounts before the on-Stop persist
   runs), and a large audio blob can't `sendBeacon` on unload the way the small transcript delta does. The audio
   fallback is therefore broadly dead independent of my regression — see the P2 finding below.

3. **After-pitch not generating (C).** Almost entirely downstream of (A)/(B): an empty/one-sided transcript
   produces nothing by design. Compounding it: the backfill only recovered the *Dissect*, and the After-Pitch
   summary had no server-side recovery at all (it generates only on page view), so a never-viewed session
   showed nothing.

## 3. Remediation (shipped, live on elostate.com)

**P0 — capture** (`b2515343`), `useLiveCoaching.ts`:
- New `teardownForReconnect()` frees only the socket + audio graph; the reconnect **reuses the running
  recorder + live mic stream** — recording is continuous, nothing captured before a drop is discarded, and it
  remains the upload→re-transcribe fallback even if STT never recovers.
- A failed reconnect **retries instead of latching dead** (pure `reconnectPolicy.ts` / `canAttemptReconnect`);
  budget 3→6 consecutive, refilled only after a socket stays open `RECONNECT_STABLE_MS` (8 s) so an
  open-then-instant-drop provider can't loop forever.
- Exhausted reconnects **fail loud** with an honest message (audio still recording → tap Stop to save).

**P1 — generation recovery** (`92d4c751`):
- `dissectBackfill` regenerates the **full 5-engine set** (`generateSessionArtifacts`), not just the dissect.
- The After-Pitch summary is recovered too, via a new shared `generateAndStoreAfterPitch` (A16 drift-guard;
  the after-pitch route now runs the identical sequence), with a de-dup guard.
- Both backfill routes: `maxDuration` 60→300; caps lowered (cron 12→6, manual 6→4) to bound the LLM burst.

**Backlog** (`d2ac9f7f`): backfill cron daily → every 3 h to drain the ~57 recoverable (transcript-but-no-review)
sessions in ~1–2 days.

## 4. Residuals (open, lower priority)

- **Founder validation required:** the reconnect recovery path is not verifiable headless — needs a real
  15+ min mobile call to confirm capture survives a mid-call drop.
- **Partial-success marker hole — INVESTIGATED, judged low-priority (2026-08-21).** A session whose dissect
  succeeded but a sibling engine failed keeps the `dissect_generated` marker, so the backfill won't retry the
  sibling. Measured prevalence looked high at first (51% of dissected sessions miss ≥1 sibling marker, mostly
  moments 37/83), BUT the sibling engines emit their marker ONLY when there is signal (`salesMoments.ts:89`:
  no moments → no marker), so a missing marker mostly means the engine HONESTLY found nothing (§3.4), not a
  failure. The markers cannot distinguish honest-empty from failed, and re-running would just re-produce the
  empties (LLM waste). A correct fix would need a per-engine `*_attempted` marker (mirroring
  `dissect_attempted`) so the backfill can skip honest-empties; deferred until it's shown to matter.
- **Proactive WS keepalive:** deferred — the robust reconnect now recovers from an idle/background close, but a
  keepalive ping would avoid the drop entirely on backgrounded calls.
- **Unrecoverable backlog:** ~54% of past sessions have no transcript AND no audio — nothing to recover; P0/P1
  fix new calls only.

- **✅ FIXED (founder-directed) — incremental audio upload.** The audio now uploads in ~15s chunks DURING the
  call and is stitched into `recording.webm` on session end (auto-close cron for the never-Stopped case), so it
  survives any ending, not only a clean Stop. `docs/tbc/2026-08-21-incremental-audio-upload/`. Founder validates
  a real never-Stopped call leaves a playable recording. (Supersedes the P2 finding below for new calls.)

- **P2 finding (superseded for new calls) — the audio fallback (`persistRecording`) was broadly dead for never-Stopped sessions.** `noAudio`
  is ~97–100% every day (per-day trend). The audio saves only on a CLEAN Stop; a tab-close unmounts the panel
  before the on-Stop persist runs, and a large blob can't `sendBeacon` on unload. IMPORTANCE dropped by P0: the
  audio is a FALLBACK for when live STT fails, and P0 makes the *transcript* (the primary artifact) reliable, so
  fewer sessions need the fallback at all. A real fix is incremental audio-chunk upload DURING the call (mirroring
  the 4s transcript flush) — a significant build, and arguably better absorbed by the self-hosted-voice migration
  than bolted onto the browser MediaRecorder path. Founder-gated (effort vs. the now-reduced need).

- **P2 opportunity — auto-re-transcribe empty-but-has-audio before the 2-day purge (holistic ripple, §1.5).**
  P0 now SAVES the recording even when live STT produced an empty transcript (previously that audio was also
  lost). That audio can recover the transcript via re-transcription — but `recording-purge-cron` deletes it
  after `RETENTION_DAYS=2` unless `recording_saved`. Verified NO regression: the review backfill generates
  from the stored TRANSCRIPT (which the purge keeps), not the audio, so it's unaffected. The opportunity: a
  session with a saved recording but an EMPTY/one-sided transcript is now recoverable, and an automatic
  re-transcribe-before-purge (extend the existing one-sided auto-recover to the fully-empty case) would
  capture those instead of letting the 2-day window expire. Founder-gated (LLM/STT cost per recovery).
