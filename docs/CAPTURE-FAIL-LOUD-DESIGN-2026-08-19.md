# Design — fail loud when a call ends with no capture (2026-08-19)

**Status:** DESIGN ONLY — not built. Awaiting founder go (option 1 of the capture-reliability threads).
**Problem:** see `SPEAKER-LABEL-ALL-AGENT-FINDINGS-2026-08-19.md`. 19 real (>5min) calls ended with no
transcript AND no audio, silently marked `ended`; the rep believes they were coached.

## The seam (traced in code)

End and capture are decoupled:

- `useLiveCoaching.stop()` ([useLiveCoaching.ts](../src/lib/coach/v5/useLiveCoaching.ts#L720)) fires
  `/finalize` **only if `captured.length > 0`** — a session that captured zero turns skips finalize entirely.
  Both `/finalize` (transcript) and the recording upload are best-effort with swallowed `.catch`.
- `PATCH /api/coach/sales-session/[id]` sets `status='ended'` **unconditionally**
  ([route.ts](../src/app/api/coach/sales-session/[id]/route.ts#L108)) — no capture check.

So "ended" ≠ "captured". Total loss = (no captured turns OR finalize failed) AND (upload failed).

## The fix (fail loud, do not silently end)

The honesty principle (fail loud over silent) says: at end-time, if the session has **no transcript and no
saved audio**, the rep must SEE it — not discover a blank review later. Two candidate placements:

1. **Client-side, at Stop (preferred for immediacy):** after the recorder produces its blob, if
   `captured.length === 0` AND the blob is empty/missing, show a blocking "This call wasn't captured — check
   your mic and retry" state instead of the normal end→name→next flow. Cheap, instant, no server round-trip.
   Workflow-continuity (the layer-3 seam): the rep's next action is obvious (retry / discard), not a dead end.

2. **Server-side backstop (defense in depth):** a check that flags an `ended` session which, after a grace
   window, still has 0 transcript segments and no `audio_asset_url`. Surfaced via the EXISTING `capture-health`
   endpoint (extend it) + optionally a per-rep notice. Catches the cases the client guard can't (network drop
   before the client can render, browser killed).

Recommended: **both** — (1) for the live rep, (2) as the backstop + manager visibility. (1) is the smaller,
higher-value first commit.

## Workflow-continuity trace (the L3 seam)

- **Before:** rep finishes pitch → taps Stop.
- **Today (broken):** Stop → (silently no capture) → name → "next door" → later the review is blank; rep never
  knows the call was lost.
- **After (1):** Stop → capture check → if empty, "Not captured — Retry / Discard" → rep retries on the spot.
  A captured call is unchanged (no extra step on the happy path).

## Open questions for the founder (before building)

- **Q1.** On a detected no-capture at Stop, block with Retry/Discard, or just warn and continue? (Blocking is
  more honest but adds friction on a false positive.)
- **Q2.** Should a no-capture ended session be **excluded** from the rep's session list / KPIs (it has no
  content), or shown with a "not captured" badge (honest, visible)? The badge is more consistent with the
  honesty thesis.
- **Q3.** Grace window for the server backstop before it flags (a legitimately slow finalize shouldn't be
  flagged as lost) — 5 min? 15?

## Test plan (when built)

- Unit: capture-check predicate (0 turns + no blob → not-captured; turns present → captured; blob present →
  captured). Both branches.
- Render: Stop with empty capture shows the Retry/Discard state; Stop with capture shows the normal name flow.
- Route (if server backstop): capture-health counts a no-transcript-no-audio ended session as `lost` (already
  does) AND the new never-ended + duration extensions.

No code written yet — this is the trace-before-build discipline so execution is fast + correct on approval.
