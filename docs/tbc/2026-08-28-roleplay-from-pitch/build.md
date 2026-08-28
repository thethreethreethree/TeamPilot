# BUILD — Role Play from a recorded pitch

### Reconstruct the customer from the pitch transcript
- write-path: `practiceScenario.ts buildPitchReplaySystemPrompt` + `buildPitchReplayUserMessage` — the model
  reconstructs the CUSTOMER (persona + the objections they actually raised) from the non-diarized transcript into
  the existing `PracticeScenario` JSON; `parsePracticeScenario` (unchanged) is the §3.4 null-on-empty seam.
- read-path: the roleplay engine's prospect is seeded with THIS customer's persona + objections, so the same
  resistance recurs when the rep re-pitches.

### The seed route (RLS-gated, honest fallback)
- write-path: `practice-scenario/from-pitch/route.ts` — `POST {pitchId}`; RLS-reads the pitch (non-null = access),
  its transcript + top improvement; reconstructs via `dissectCoachV5` + the CONVERSATION_IS_DATA fence; returns
  `{scenario, focus}` (focus = the pitch's weak spot). `maxDuration=60`, rate-limited.
- read-path: a pitch the caller can't see → 404 (no transcript leak); a missing transcript / bad parse →
  `{scenario:null}` (client falls back to a plain roleplay).

### Wire the client + the button
- write-path: `roleplay/page.tsx` — a `?pitchId=` mount effect calls `loadFromPitch` (seeds persona/situation +
  the weak-spot focus, latches `scenarioAttemptedRef` so the generic auto-scenario can't overwrite it; skips if an
  in-progress practice is recovered). `PitchDetail.tsx` — a "Role play" CTA on a completed pitch with a transcript.
- read-path: rep clicks Role play → lands on the roleplay setup pre-seeded with their customer → practices → gets a
  review scored on the pitch's weak spot → can practice again.

## Files
- `src/lib/coach/v5/practiceScenario.ts` — pitch-replay prompt builders
- `src/app/api/coach/sales-session/practice-scenario/from-pitch/route.ts` — new seed route
- `src/app/dashboard/sales-coach/roleplay/page.tsx` — `?pitchId=` seed (loadFromPitch + mount effect)
- `src/components/sales-coach/doorlog/PitchDetail.tsx` — the "Role play" CTA
- `src/lib/coach/v5/__tests__/practiceScenario.test.ts` — +3 pitch-replay prompt cases

## Ripple (§6 item 5)
- The roleplay engine, its review/scoring, and `parsePracticeScenario` are UNCHANGED — the feature only adds a new
  seed source. The engine's ephemeral contract (roleplay not persisted, doesn't pollute metrics) is untouched, so a
  replay can't corrupt the rep's real pitch stats.
- The new route mirrors `practice-scenario` (auth + companyId + corpus + fence + maxDuration), so the invariant
  audits (LLM-route maxDuration, injection fence, CWE-209 generic errors, auth gate) all apply the same way.
- The `?pitchId=` seed composes with the existing `?focus=` seed and the recovery effect (guarded to not clobber).

## Honest limit (verify)
- The RECONSTRUCTION QUALITY (does the model rebuild the customer + objections faithfully from a non-diarized blob)
  is an LLM judgement — founder visual-verify on a real pitch. The prompt (faithfulness/no-coaching/infer-speaker,
  transcript clamp) + the null fallback are unit-gated; the wiring is typechecked.
- The client seed + button render are founder visual-verify (client pages have no jsdom harness here).
