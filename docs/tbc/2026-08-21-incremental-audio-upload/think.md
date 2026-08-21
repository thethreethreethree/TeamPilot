# THINK — Incremental audio upload (never lose the recording)

**Trigger:** Founder, 2026-08-21: "how can we fix the failed audio file recording effectively?" → chose
*incremental upload during the call*. One of the three named crisis issues ("failed session recording").

## Understanding (§0)

The audio recording saves ONLY on a clean Stop (`persistRecording` uploads the full blob when the rep taps
Stop). But the record shows reps overwhelmingly do NOT cleanly Stop — recent sessions all have multi-hour
durations = auto-closed, never Stopped. So the audio is never saved for them. (Historical `audio_asset_url`
null-rate is CONFOUNDED by the 2-day purge, so it can't prove a clean-Stop bug; the confirmed fact is
save-only-on-Stop + reps-don't-Stop.)

**An effective fix must not depend on the rep tapping Stop.** → upload the audio AS it is recorded, so it is
already in storage no matter how the session ends (drop, tab-close, phone-lock, crash, never-Stop).

## Design (additive — does NOT touch the fragile reconnect/recorder core beyond a timeslice)

1. **Recorder** (`useLiveCoaching.ts`): start the MediaRecorder with a **timeslice** (~15s) so
   `ondataavailable` fires periodically instead of once on stop. Each chunk is (a) accumulated in `chunksRef`
   as today (the existing clean-Stop persist is unchanged) AND (b) uploaded fire-and-forget to a new endpoint.
   Sequential MediaRecorder chunks byte-concatenate into a valid webm, so order matters; each carries a `seq`.

2. **Chunk endpoint** `POST /api/coach/sales-session/[id]/audio-chunk?seq=N` — owner-gated (mirrors
   /segments), service-role writes the raw body (~150KB, well under the body cap) to
   `${companyId}/${sessionId}/chunks/${seq}.webm`. Append-only; idempotent on (session, seq).

3. **Stitch** (`stitchSessionAudio`): list the session's chunk objects, byte-concat in seq order UP TO the
   first gap (a dropped chunk truncates the tail, never corrupts the head), upload the final
   `${companyId}/${sessionId}/recording.webm`, stamp `audio_asset_url`. **Idempotent** — skip if
   `audio_asset_url` is already set (e.g. a clean Stop already persisted the full blob). Best-effort chunk
   cleanup after.

4. **Trigger:** the **auto-close-stale cron** stitches each session it closes that has chunks but no
   `audio_asset_url` (the never-Stopped population — exactly the gap). Clean-Stop sessions keep using
   `persistRecording` (unchanged); the stitch skips them (idempotent), and their orphan chunks are cleaned.

## Why additive / low-risk to the un-validated P0 path
- The only change to the recorder is `rec.start(timeslice)` — it does NOT touch reconnect/teardown. onstop
  still builds the full blob from all chunks, so the existing clean-Stop persist is byte-identical behaviour.
- The chunk upload is fire-and-forget: if it fails, capture/transcript are unaffected and the clean-Stop
  persist still covers a Stopped call. Pure durability layer.

## Verify
- Stitch unit test: concat order, gap-truncation, idempotent skip-when-audio-set.
- Chunk route test: owner-gate, seq path pinning, writes bytes.
- Gate green; founder confirms on a real call that a never-Stopped session leaves a playable recording.
