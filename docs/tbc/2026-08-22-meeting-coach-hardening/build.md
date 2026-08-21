# BUILD — Meeting Coach client hardening

Client-only, no sales/server change. Framed as the three surfaces the audit touched (write-path = what changes
state / renders; read-path = what the user then sees).

### Reconnect resource lifecycle
- write-path: `useMeetingCoaching` splits `teardownTransport` (closes socket + ScriptProcessor + AudioContext,
  keeps the mic stream); `start(isReconnect=true)` calls it before rebuilding the transport.
- read-path: after a drop, capture resumes with the transcript continuing — and no AudioContexts accumulate, so
  a flaky network can't exhaust the browser's context cap and silently end capture.

### Session end / error recovery
- write-path: `endSession` (panel) calls `coach.stop()`, resets the start once-latch, clears sessionId + title.
- read-path: the facilitator lands back on the setup form — a mic-permission failure or a finished meeting is
  never a dead-end; they can start another meeting. The Stop button reads "Back to setup" in the error state.

### Theme-legible surface
- write-path: the panel renders every neutral color via the app's semantic tokens (text-primary/secondary/muted,
  bg-surface, bg-surface-raised, border-default/strong) instead of hard-coded zinc.
- read-path: text and surfaces are legible in BOTH light and dark; `theme:audit` passes (see check.md).

## Not changed
The two minor UX judgment calls the audit noted (no un-set for "Wrapping up"; mic stays hot on a terminal STT
failure) are left as-is — not defects, not manufactured into churn (§1.5.2 quality-over-quantity).
