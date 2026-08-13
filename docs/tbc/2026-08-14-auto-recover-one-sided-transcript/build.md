# BUILD — automatic recovery of a one-sided (customer-missing) transcript

### autoSpeakerAssign (pure agent-cluster decision, no rep tap)
read-path: `src/lib/coach/v5/autoSpeakerAssign.ts` — `autoAssignAgentCluster({ diarized, knownAgentTurns })`
reads the diarized clusters + the live transcript's agent turns.
write-path: none (pure). Returns a discriminated union: `{decided:true, agentSpeakerId, confidence, source}`
via cross-match (overlap coefficient vs known agent turns) or content-tell tally; else `{decided:false,
reason:"single-cluster"|"ambiguous"|"no-signal"}`. Never returns a confident guess — the caller only writes on
`decided:true`. No first-speaker auto-save.

### captureGap (detection predicate)
read-path: `src/lib/coach/v5/captureGap.ts` — `detectCaptureGap(summary)` reads the talk_ratio caveat +
scores/narrative; `afterPitchNeedsAutoRecover(summary, hasSavedRecording)`.
write-path: none (pure). Returns `"customer-missing" | "agent-missing" | null`. The customer-missing case (the
founder's `scores.length===2` shape) is the auto-recover trigger — NOT `scores.length===0`.

### blankReadRecovery (manual fallback visibility)
read-path: `src/lib/coach/v5/blankReadRecovery.ts` — `shouldOfferBlankReadRecovery({gap, hasSavedRecording,
autoRecoverResolved})`.
write-path: none (pure). The manual one-tap card shows only after auto-recover resolved without recovering, or
for the agent-missing direction; never on a two-sided (null gap) read.

### auto-recover endpoint
read-path: `src/app/api/coach/sales-session/[id]/auto-recover/route.ts` reads getSession, getSessionTranscript,
computeTalkRatio (precondition), and re-diarizes the saved audio (downloadAssetBytes + transcribeWithDiarization).
write-path: owner-only. Atomically claims `auto_recover_attempted_at` (service-role conditional UPDATE) BEFORE
any STT. On a confident assignment: `deleteSessionTranscriptSegments` (checked → 500 on failure, never a partial
re-save), `appendTranscriptSegment` per re-diarized segment (agent cluster → 'agent', else 'customer'), then
`after(generateSessionArtifacts)` to regenerate the other artifacts. Declined assignment → no delete/append.

### migration 0211 — at-most-once marker
read-path: `supabase/migrations/0211_sales_coach_auto_recover_marker.sql`.
write-path: `alter table coaching_sessions add column if not exists auto_recover_attempted_at timestamptz`
(additive, nullable, idempotent). The persistent cost/re-entrancy guard.

### after-pitch page wiring
read-path: `src/app/dashboard/sales-coach/[id]/after-pitch/page.tsx` reads afterPitchNeedsAutoRecover on load.
write-path: POSTs `/auto-recover` at most once per id (client latch), ordered BEFORE the LLM heal; on
`recovered` rebuilds the read via `generate()`; else shows the manual fallback card with direction-aware copy.

## Test coverage
- `autoSpeakerAssign.test.ts` (8): cross-match win, content-tell win, cross-match overrides content-tell, and
  the DECLINE cases — single-cluster, ambiguous, no-signal, weak-separation, coin-flip.
- `captureGap.test.ts` (9): customer-missing at scores.length===2 (regression pin), agent-missing, healthy null,
  starved-two-sided null; afterPitchNeedsAutoRecover truth table.
- `blankReadRecovery.test.ts` (5): hidden on null gap + in-flight; shows on resolved customer-missing +
  agent-missing.
- `auto-recover/route.test.ts` (11): 401/404/403-non-owner, 409 no-audio, 409 canonical (no STT, no delete),
  not-applicable, already-attempted (no STT — cost guard), recovered (delete→append→regenerate), could-not-decide
  + still-one-sided (no delete), delete-fails → 500 no append.
- `label-transcript/route.test.ts`: the delete-guard regression case is retained (asserts no append on a
  failed clear); the full-gate result is in closure.md.
