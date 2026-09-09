-- 0246_voice_enrollment.sql
--
-- Voice-recognition gate — mandatory per-rep voice enrollment (partner meeting 9/2, founder direction
-- 2026-09-09: "I am the founder, we need to build this now"). Approach chosen by the founder: an acoustic
-- reference, NOT ML voiceprint biometrics. Enrollment captures the rep reading a short prompt, runs the
-- SAME client-side F0 detector the live coach already uses (detectF0 / McLeod method, pitchSeparation.ts),
-- and stores only the derived FUNDAMENTAL FREQUENCY — a single number in Hz — never the audio. That number
-- seeds the live pitch clusterer's agent centroid from turn 1, so the rep's turns are identified against
-- their KNOWN pitch instead of the current "assume the first speaker is the rep" guess.
--
-- Two columns on profiles:
--   voice_f0_hz       — the rep's enrolled median fundamental frequency (Hz), ~70–400 for human speech.
--   voice_enrolled_at — when they enrolled (also the gate flag: NULL = not yet enrolled).
--
-- Neither is an authorization boundary — a rep sets their OWN voice profile for their OWN attribution
-- quality, exactly like macro_mode_enabled (0219). The gate it drives is a PRODUCT/quality gate (better
-- speaker attribution), not a security boundary: a rep who games their own enrollment only degrades their
-- own read. So these are self-updatable via the existing "own profile - update" policy (0001) and are NOT
-- added to the 0090/0091 authz-column freeze. Forward-only, idempotent. Storing an F0 number (not audio)
-- keeps this off the biometric-data surface by construction.
alter table profiles
  add column if not exists voice_f0_hz real,
  add column if not exists voice_enrolled_at timestamptz;
