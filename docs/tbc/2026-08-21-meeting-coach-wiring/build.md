# BUILD — Meeting Coach server-side wiring (wiring-spec Steps 1–5)

Two data features, each with both reachability paths (A31 — schema-complete is not built until a write path AND
a read path exist). The supporting pure pieces (resolver, provider binding, mode chokepoint) are listed under
them.

### session_kind coaching classification
The session's coaching kind (`sales|meeting|huddle`), distinct from `context` (where the call happens).
- write-path: `supabase/migrations/0237_coaching_session_kind.sql` adds `coaching_sessions.session_kind`
  (default `sales`, CHECK-constrained, indexed). The value is set when a meeting/huddle session is created
  (the client session-create — Step 6, flagged pending; until then all rows are `sales`).
- read-path: `getSession` → `mapSession.sessionKind` (A34-defaulted to `sales`) → `resolveCoachingMode`
  (`src/lib/coach/strategy/resolveCoachingMode.ts`, total, safe-defaults `sales`) → `selectStrategy`.

### Live meeting/huddle cue
A facilitation cue produced by the meeting/huddle brain over the live transcript and recorded for Dissect.
- write-path: `POST /api/coach/meeting-session/[id]/cue` (owner-gated; mode-routed — 400 if the session resolves
  to `sales`) runs `selectStrategy(mode, { cueLLM })` with `liveMeetingCue` bound to the session's company, then
  persists a delivered cue via `appendCue` → `coaching_cues`, mapping the mode through the
  `toCoachingCuesMode` chokepoint (`src/lib/coach/strategy/persistCueMode.ts`, directive→guide_response) and
  stamping `latency_ms`.
- read-path: the route returns the `CueDecision` (`shouldCue/cue/phase/importance/trigger`) to the client cue
  loop (Step 6, reuses the sales `speakCue`→tts earpiece delivery); Dissect later reads the `coaching_cues` rows.

## Supporting pieces
- `src/lib/claude.ts` — `liveMeetingCue` mirrors `liveSalesCue` (same provider cascade, `{text, suppressed}`,
  maxTokens 160). `controlExempt: true` per the founder's day-1 decision (no §3.4 control-month for meetings).

## Reused vs new
- REUSED untouched: the whole live engine (`useLiveCoaching` capture, `/cue` loop pattern, `speakCue`/tts
  earpiece delivery), `coaching_sessions`, `coaching_cues`, `appendCue`, `getSession`, `selectStrategy` + the
  strategy core. The sales `/cue` route is NOT touched.
- NEW: migration 0237, `resolveCoachingMode`, `liveMeetingCue`, `persistCueMode`, the meeting cue route, the
  `SalesSession.sessionKind` field.
