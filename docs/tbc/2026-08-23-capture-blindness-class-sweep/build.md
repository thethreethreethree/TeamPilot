# BUILD — Capture-blindness class sweep (live + meeting + C.A.R.E recorders)

### one shared diagnostics primitive, reported by every recorder
- write-path: `src/lib/coach/captureDiag.ts` — `CaptureDiag` shape + `buildCaptureDiag` (pure) +
  `reportCaptureDiag(surface, diag, sessionId?)` (best-effort keepalive POST). Each recorder now observes
  `onerror` + the mic track's `ended`/`mute`, and reports a `coach.capture_failed` diag when a meaningful-duration
  session captured nothing.
- read-path: `POST /api/coach/capture-diag` appends a `coach.capture_failed` event (company-pinned, INV15; scoped
  to `coaching_session:<id>` or `rep:<user>` for C.A.R.E). The founder can query
  `events where kind='coach.capture_failed'`, filter by `payload.surface`, to see the real cause per surface.

### per recorder
- write-path: each recorder adds `rec.onerror` + mic-track `ended`/`mute` detection and reports a diag on a >3s
  zero-capture session. live (`useLiveCoaching.ts`) flips its `audioCapturing` banner off on track death; meeting
  (`useMeetingCoaching.ts`) records the cause alongside its M4 `recordingSaved`; C.A.R.E (`useVoiceMode.ts`) fires a
  one-time deaf-call diag (subject `rep:<user>` — the conversation id isn't reliably in scope).
- read-path: live's honest "not recording" banner now reflects track death LIVE (not only at Stop); meeting's M4
  `recordingSaved` surfaces post-stop honesty; C.A.R.E's dead call is now a `coach.capture_failed` event instead of
  a silent forever-rearm. All three are queryable via `events where kind='coach.capture_failed'` by `payload.surface`.

## Files
- `src/lib/coach/captureDiag.ts` (NEW), `src/app/api/coach/capture-diag/route.ts` (NEW).
- `src/lib/coach/v5/useLiveCoaching.ts`, `src/lib/coach/v5/useMeetingCoaching.ts`,
  `src/components/care/voice/useVoiceMode.ts` — onerror + track-death + diag report.
- tests: `captureDiag.test.ts` (2 — pure builder), `capture-diag/route.test.ts` (6 — auth/company-pin/scoping/validation).

## Ripple (§1.5)
Additive to three load-bearing files (live reconnect seams; C.A.R.E turn-lock/VAD). No path rewritten; the >3s
guard avoids reporting a quick start/stop; all reporting best-effort. No schema change (reuses `events`). Every
existing recorder suite passes unchanged (80 files / 584 tests).
