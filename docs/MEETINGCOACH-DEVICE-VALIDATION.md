# Meeting Coach — device validation protocol

> The in-person MVP is code-complete + gate-green, but the live-capture client (mic/WebSocket/AudioContext/
> MediaRecorder) is **not unit-testable** — it can only be confirmed on a real device. This is the exact
> checklist to prove it works end-to-end. Run it once on a phone with an in-ear earpiece.

## Precondition (blocking — do this first)

1. **Apply migration 0237:** `npm run db:apply`. Until this runs, the create route returns a fail-honest 500
   ("migration 0237 may not be applied") and NO meeting session can be created. Verify with a quick check that
   `coaching_sessions.session_kind` exists after applying.
2. Confirm the deployed build is current (`curl <site>/api/health` → `build.commit` matches `6fe34caa` or later).

## The run (≈5 min, in-person / huddle mode)

1. Open **`/dashboard/meeting-coach`** on the phone.
2. Pick **Huddle**, **In person**, give it a title, check the earpiece box, tap **Start coaching**.
   - ✅ EXPECT: it creates the session and moves to the live view; status shows **Connecting… → Listening**.
   - ❌ IF it 500s on Start → migration 0237 isn't applied (see precondition) OR the realtime-token/STT scope is
     off (check Settings → Coaching → Voice provider health, same as sales).
3. **Talk for 2–3 minutes** as if running a short stand-up — deliberately: circle a point without deciding it,
   mention a task with no owner, give a vague "almost done" status.
   - ✅ EXPECT: the rolling transcript fills in (unlabeled — one stream, that's correct for the MVP).
   - ✅ EXPECT: within a few turns, a **cue** appears in the "Coach" box AND is spoken to your earpiece —
     something like "No decision was made on X — close it" or "That task has no owner." (Auto-coach is ON.)
   - ✅ ALSO: tap **Coach me now** — it should force a cue even mid-silence.
4. Tap **Stop**.
   - ✅ EXPECT: it returns to the setup form (no dead-end).

## Verify it persisted (the part the UI doesn't show)

Against the live DB (read-only), for the session you just ran:

1. **The cues were recorded** — `coaching_cues` has rows for the session (mode `suggestion`/`guide_response`,
   the cue text, `latency_ms`, `trigger` like `undecided`/`vague_status`).
2. **The audio saved** — the session's `audio_asset_url` is set (from the clean-Stop persist), OR the
   `${company}/${session}/chunks/` prefix holds the uploaded 15s chunks (which the auto-close-stale cron stitches
   into `recording.webm` within 6h if you didn't cleanly Stop). Either way the audio survived.
3. **The kind is right** — the row's `session_kind` = `huddle` (or `meeting`).

## What a PASS proves

- The separate meeting transport (mic → Scribe STT → cue endpoint → earpiece TTS) works on real hardware.
- The meeting brain produces grounded facilitation cues (not sales "closing" cues) and stays quiet otherwise.
- The reused sales durability infra (audio-chunk upload + stitch/persist) genuinely saves a meeting's audio.

## Known-and-expected (NOT failures)

- **No "who's dominating" cue** — the imbalance monitor needs per-speaker labels; single-mic MVP is unlabeled, so
  it stays silent by design (diarization is a later enhancement).
- **No post-meeting summary/Dissect yet** — Stop returns to setup; the recorded cues + audio are the input to the
  future Dissect (which needs your §3.5 call on what a "good meeting" measures).
- **A video meeting** — `context: video` is accepted, but platform-caption attribution isn't built; treat video
  as "capture the room audio" for now (the big platform-caption integration is deferred).

## If something fails

- Cues never fire but transcript fills → the cue route or `liveMeetingCue`/DeepSeek; check the browser console
  for `[coach/meeting-cue]` and the network tab for the `/cue` POST status.
- Transcript never fills → STT: the WS close code is surfaced in the error banner; ElevenLabs realtime scope
  (same class as the sales `reference_elevenlabs_scoped_key_401`).
- Audio not saved → the `/audio-chunk` POSTs (network tab) or the clean-Stop `persistRecording` sign→upload flow.
