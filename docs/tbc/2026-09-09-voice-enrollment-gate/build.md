# BUILD — voice-recognition gate: enrollment as an acoustic reference (slice 1)

### Schema — a pitch number on the rep's profile, not audio
- write-path: `supabase/migrations/0246_voice_enrollment.sql` adds `voice_f0_hz` + `voice_enrolled_at` to
  profiles — self-settable feature columns (like macro_mode), NOT authz, so 0090's freeze is unaffected.
- read-path: the gate predicate reads `voice_enrolled_at`; attribution reads `voice_f0_hz`. A stored F0 number
  is not re-identifying audio, so enrollment is off the biometric surface by construction.

### The pure core — derive and validate the F0
- write-path: `src/lib/coach/v5/voiceEnrollment.ts` — `deriveEnrollmentF0` (median of in-range voiced frames,
  null when too thin), `isValidEnrollmentF0` (server re-validation), `isVoiceEnrolled` (gate predicate). Reuses
  `MIN_F0`/`MAX_F0` newly exported from `pitchSeparation.ts` (single source, §2.2).
- read-path: the API and (later) the gate consume these; unit-pinned by `voiceEnrollment.test.ts` (7 tests).

### The API — store/read on the caller's own row
- write-path: `src/app/api/coach/voice-enrollment/route.ts` — POST validates the client-derived number + frame
  count, writes `voice_f0_hz` + `voice_enrolled_at` on the caller's profile (caller-scoped, RLS own-row). GET
  returns `{ enrolled, f0Hz }`. Both degrade honestly pre-migration via `isMissingColumnError` (§A34).
- read-path: `route.test.ts` (8 tests) pins 401 / 422-on-garbage / own-row write / 503-when-migration-pending.

### The capture UI — reuse the live detector, send only the number
- write-path: `src/components/sales-coach/VoiceEnrollment.tsx` — Web Audio capture (mirrors the live coach's
  AudioContext + ScriptProcessor) running `detectF0` per frame, auto-stops once there's enough voiced signal,
  derives the median, POSTs just the number. Placed on the settings Account tab.
- read-path: three states render correctly (idle / recording with level+progress meters / enrolled) — verified
  by headless render (LAW 1). Prominent privacy line: "a number, never a recording of your voice."

### Attribution seeding — the value
- write-path: `PitchSeparator.seedAgentCentroid(f0)` anchors the agent cluster to the enrolled pitch;
  `useLiveCoaching` fetches the enrolled F0 once and seeds it after each `reset()`.
- read-path: the rep's turns are grounded to their KNOWN pitch from turn 1 instead of the first-speaker guess;
  no enrollment → the existing bootstrap runs unchanged. `pitchSeparation.test.ts` pins the seed (2 new tests).

### The prompt (non-blocking rollout)
- write-path: `src/components/sales-coach/StartSessionPanel.tsx` — a non-blocking "enroll your voice" banner
  when GET reports not-enrolled, linking to Settings. Session start is UNCHANGED (no hard gate this slice).
- read-path: an un-enrolled rep is nudged to enroll but never blocked — the founder's "prompt now, hard-enforce
  after verified" rollout.

### Product knowledge (standing rule)
- write-path: `src/lib/care/elostateProductKnowledge.ts` — the Sales Coach entry now describes the one-time
  voice enrollment (pitch reference, not a recording).
- read-path: Jeff answers voice-enrollment questions correctly from the same commit.

## Files
- `supabase/migrations/0246_voice_enrollment.sql`
- `src/lib/coach/v5/voiceEnrollment.ts` + `__tests__/voiceEnrollment.test.ts`
- `src/lib/coach/v5/pitchSeparation.ts` (+ export MIN_F0/MAX_F0, + seedAgentCentroid) + `__tests__/pitchSeparation.test.ts`
- `src/app/api/coach/voice-enrollment/route.ts` + `__tests__/route.test.ts`
- `src/components/sales-coach/VoiceEnrollment.tsx`
- `src/lib/coach/v5/useLiveCoaching.ts` (fetch + seed)
- `src/app/dashboard/sales-coach/settings/page.tsx` (place the component)
- `src/components/sales-coach/StartSessionPanel.tsx` (non-blocking prompt)
- `src/lib/care/elostateProductKnowledge.ts`

## Ripple (§1.5)
- Seeding is additive; no-enrollment path is the existing bootstrap — nothing regresses.
- Gate NOT enforced this slice: session start unchanged, so no lockout is possible; enforcement is a deferred,
  verification-gated follow-up.
- No migration assumption — the route degrades honestly until 0246 applies (`npm run db:apply`).
