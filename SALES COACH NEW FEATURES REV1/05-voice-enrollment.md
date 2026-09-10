# 05 — Voice-recognition gate (enrollment) — REQUIRES native mic + pitch detection

**What it is.** A one-time **voice enrollment**: the rep reads a short prompt, the app measures their voice's
**fundamental frequency (pitch)** and stores a single **number** (Hz) — never a recording. That reference is
meant to sharpen live speaker attribution (telling the rep's side from the customer's). Founder-chosen approach:
an **acoustic pitch reference, NOT ML voiceprint biometrics** — which keeps it off the biometric-data surface.

**App work is NATIVE:** the web did mic capture + pitch detection in the browser (Web Audio); the app does it
with a native audio module. The storage + endpoints are shared.

## Web source of truth
- Migration `0246`: `profiles.voice_f0_hz` (real, the enrolled median F0 in Hz) + `profiles.voice_enrolled_at`
  (timestamptz; also the gate flag — NULL = not enrolled). Self-settable feature columns (like macro_mode), not
  authz.
- Endpoint: `GET /api/coach/voice-enrollment` → `{ enrolled, f0Hz }`. `POST` `{ f0Hz, voicedFrames }` → validates
  the number is in the human range and enough voiced frames backed it, then writes the caller's own profile.
  Caller-scoped (a rep writes only their own). Degrades to 503 "not available yet" until 0246 rolls out.
- Pure core: `src/lib/coach/v5/voiceEnrollment.ts` — `deriveEnrollmentF0(f0Samples)` = median of in-range voiced
  frames, or null when too few (`MIN_VOICED_FRAMES = 25`); `isValidEnrollmentF0(n)` = in `[70, 400]`;
  `isVoiceEnrolled(profile)` = `voiceEnrolledAt` set.
- Pitch detector: `src/lib/coach/v5/pitchSeparation.ts` — `detectF0(frame, sampleRate)` uses the **McLeod Pitch
  Method** (NSDF + first-strong-peak + parabolic interpolation), human range **70–400 Hz**, RMS gate for silence.
- Web UI: `src/components/sales-coach/VoiceEnrollment.tsx` (on the Settings → Account screen) + a non-blocking
  "enroll your voice" prompt on the start panel.

## The contract the app must honor
1. Capture ~a few seconds of the rep reading the prompt at ~16 kHz mono.
2. Per frame (a ~2048-sample window), estimate F0 with a pitch algorithm (McLeod/MPM or YIN); collect the values.
3. Keep only in-range voiced frames; require ≥ ~25 of them; take the **median** → the enrolled `f0Hz`.
4. `POST /api/coach/voice-enrollment { f0Hz, voicedFrames }`. On 422 (too thin/out of range), ask for another
   take in a quieter spot.
5. **Send only the number.** Never upload the audio.

## UI to build (native)
- A "Voice enrollment" panel: a read-aloud prompt, a Start button, a live mic-level + "N voiced frames" progress,
  auto-stop once enough is captured, and an enrolled state ("Voice enrolled · N Hz") with Re-enroll. Prominent
  privacy line: "We store a pitch reference (a number) — never a recording of your voice."

## IMPORTANT — the attribution SEED is currently UN-WIRED
The web wired the enrolled F0 into live attribution and an adversarial review found a **hard-anchored** seed
INVERTS attribution when the rep's calm enrollment pitch differs from their animated live pitch (≥25 Hz apart).
The founder chose to **un-wire it** until a self-correcting version is validated. So for now: **capture + store the
enrollment and gate on it, but do NOT feed the enrolled F0 into live speaker attribution.** Enrollment today =
the gate + a stored reference; the attribution benefit waits for a validated seed.

## Rollout
The gate is **prompt-now, hard-enforce-after-verified** (founder choice): prompt un-enrolled reps but do NOT hard
-block a session start until the native capture flow is verified with a real device. Mirror that — soft prompt
first.
