# CLOSURE — Meeting Coach brain: 3rd-review fixes + session-lifecycle end route

## What shipped
Four adversarial-review fixes on the (still-UNWIRED) coaching brains, plus a new additive end route:
- **A** — a FORCED cue that errors now re-throws (route 502s honestly); AUTO cues still stay silent.
- **B** — an out-of-vocab / cross-domain-leaked trigger is DROPPED from an AUTO cue (a sales `close` can never
  surface in a meeting).
- **C / D** — the attribution boundary is hardened (A39): a speaker LABEL can no longer forge a line, and a
  blank/garbage speaker no longer counts toward the ≥2-known-speakers imbalance gate.
- **end route** — `POST /api/coach/meeting-session/[id]/end` stamps `ended_at` on Stop so meeting duration is
  real, instead of the ~6h the stale-close cron + 0070 trigger would produce.

Full `npm run check` exit 0. No sales-scoring or live-engine change (the strategy core is not yet wired); the
end route is additive and owner-gated.

## The un-named reliance
- **The strategy core is still UNWIRED** — these harden code the engine does not call yet. The live-wire step
  (engine calls `strategy.analyze()`) remains HELD on founder decisions (attribution source, binding gating).
- **The end route needs the panel to actually mount `MeetingCoachingPanel`** for the Stop wiring to fire; the
  6h cron remains the durable backstop if the Stop fetch is dropped (serverless/freeze).

## Residual (A36)

```json
[
  {
    "id": "finding-E-huddle-bar-prompt-only",
    "item": "Finding E (the huddle's higher cue threshold lives only in the prompt, not a code gate) was flagged by-design and left as-is.",
    "why_skipped": "The huddle threshold is a tuning knob, not a correctness invariant like the leak gate or the imbalance gate; a prompt is the right home for near-silence tuning.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-22T04:19:00+08:00",
    "outcome": "Left as prompt-level tuning; revisit only if huddle over-cueing is observed once wired."
  },
  {
    "id": "end-route-live-wire-pending",
    "item": "The end route + panel wiring are correct but only exercise once the Meeting Coach is live-wired and the panel is mounted in a real session.",
    "why_skipped": "Live-wire is HELD on founder decisions; the route is additive and safe to land now.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-22T04:19:00+08:00",
    "outcome": "Landed now with tests; device/live verification deferred to the wire-in step."
  }
]
```
