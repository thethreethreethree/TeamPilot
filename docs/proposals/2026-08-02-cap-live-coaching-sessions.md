# Proposal — Cap live-coaching sessions (bound the realtime-STT cost)

**Status:** design-ready, awaiting founder go (threshold + UX decision, live-hook change → §3.3).
**Date:** 2026-08-02
**Trigger:** The live coaching stream sends audio CONTINUOUSLY to ElevenLabs Scribe v2 Realtime — `ws.send`
in `useLiveCoaching.ts` is OUTSIDE the RMS gate, so silence is uploaded and billed at $0.08/min. The stream
stops on tab-close (websocket dies) and navigate-away (unmount → `stop()`), but there is **no idle-timeout or
max-duration auto-stop**, so a foreground-idle session (rep walks away, tab open) streams silence uncapped.
The pilot's 958-min session ≈ $76 of STT if it streamed throughout.

## Distinct from auto-close (they compose)
- **This (cap):** decides WHEN to stop the stream — bounds the *streaming cost*.
- **Auto-close** (`2026-08-02-coaching-session-auto-close.md`): what happens to the *DB record* when the stream
  stops (status→ended, metric completeness). A cap-triggered stop flows into auto-close: cap → `stop()` →
  status='ended'.

## Design — reuse the existing silence detection (cheap), plus a hard ceiling

### A. Idle auto-stop (primary) — REUSE what's already there
`useLiveCoaching.ts` ALREADY computes per-frame RMS against `VOICE_NOISE_FLOOR` (for attribution/metering) and
has a silence/stall notion for cue timing. The idle-cap reuses that signal: track the timestamp of the last
*voiced* frame; if `now - lastVoicedFrame > IDLE_LIMIT` (e.g. 5 min of continuous silence), call the existing
`stop()`. No new audio analysis — it reads a signal the hook already produces.
- **UX:** before cutting, surface a warning ("Still coaching? The session will pause in 30s to save cost")
  with a one-tap keep-alive, so a legitimate long pause isn't severed silently. On timeout, stop + show a
  "resume" affordance (start a new session).
- **Why idle, not just max:** most abandoned cost is silence after the rep leaves; idle catches it fast.

### B. Max-duration hard ceiling (backstop)
An absolute cap (e.g. 2–3 hrs) that stops the stream regardless — a safety net for the pathological runaway
(no real sales call runs 3 hrs). Catches the case where the idle detector is fooled (ambient noise above the
floor).

## Guards / risk
- Both mechanisms trigger the EXISTING `stop()` (whose teardown the 2026-07-09 audit verified sound —
  websocket close, mic tracks stop, unmount-safe). No new teardown path.
- Touches the live-untested realtime hook, so runtime-verify with a real call: (a) a real pause under
  IDLE_LIMIT does NOT stop; (b) sustained silence past it stops + warns; (c) the max ceiling fires.
- Vendor note: ElevenLabs' realtime connection MAY self-impose a max duration — worth confirming, but our
  code should not rely on it.

## Founder decisions
1. **IDLE_LIMIT** (recommend 5 min of continuous silence) and whether to warn-then-cut vs cut-immediately.
2. **MAX_DURATION** hard ceiling (recommend 2–3 hrs).
3. Whether a cap-stop should auto-finalize (compose with auto-close → status='ended') or leave the session
   resumable.

## What this bounds
- Worst-case abandoned-session STT cost drops from unbounded (958 min ≈ $76 observed) to ~IDLE_LIMIT of
  billed silence (≈ $0.40 at 5 min) before auto-stop.
- Directly de-risks the per-minute meter in the pricing model (a customer can't rack up runaway STT on a
  forgotten tab).

**Green-light phrase:** `"cap live-coaching sessions"` (± your IDLE_LIMIT / MAX_DURATION choices).

---

## Feasibility verified against the tree (2026-08-02)

The "reuses existing silence detection" claim — the thing that makes this a *small* build — was confirmed in
`src/lib/coach/v5/useLiveCoaching.ts` (not assumed):

- **Per-frame RMS already computed:** `rms = Math.sqrt(sumSq / …)` at ~1006, gated against `VOICE_NOISE_FLOOR`
  (~1007) so silence-between-words already reads as non-speech.
- **A client-side silence/stall timer already exists:** "the client's stall timer fired (long silence)" (~432,
  ~497) already drives cue behavior. The auto-stop cap is an *additional* consumer of that same signal, plus a
  wall-clock `MAX_DURATION` — not a new audio-analysis subsystem.

So the effort estimate is honest: an idle/max-duration auto-stop layered on machinery that already runs every
frame, not a from-scratch build. Green-light phrase and gating unchanged.
