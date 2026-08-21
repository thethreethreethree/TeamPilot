# CLOSURE — Meeting Coach server-side wiring

## What shipped
Wiring-spec Steps 1–5: the meeting/huddle strategy core is now CALLABLE in production via a live cue endpoint.
Migration 0237 (`session_kind`), the `resolveCoachingMode` resolver, the `liveMeetingCue` CueLLM binding
(controlExempt, day-1), the `SalesSession.sessionKind` field, the owner-gated mode-routed meeting cue route, and
the `toCoachingCuesMode` persist chokepoint + drift-guard. Full `npm run check` exit 0 (3563 tests; see
check.md for the pasted output); Sales Coach regression-clean.

## The un-named reliance (what this quietly depends on)
- **The capture layer producing a real attributed transcript.** The route accepts an N-party `liveTranscript`
  but nothing yet PRODUCES it live for a meeting. Until Steps 6–7 (client capture + UI) land, no real meeting
  cue can fire — the endpoint is unit-proven but has no caller in production.
- **Migration 0237 being applied.** Every real meeting session needs `session_kind='meeting'|'huddle'`; until
  `npm run db:apply` runs 0237, every session reads back as `sales` (A34 default) and the route 400s. Code is
  safe pre-apply; the FEATURE is inert pre-apply. Flagged loudly here, never a silent dependence.
- **The CueLLM gating being right.** `liveMeetingCue` is `controlExempt` by the founder's explicit day-1 choice.
  If that choice is revisited (meetings should honor a control-month), this ONE binding is where it changes — the
  strategy classes consume the `suppressed` verdict and don't decide the gate (A40).

## Open (next build — Steps 6–7)
1. Client capture for the in-person MVP: reuse `useLiveCoaching`'s mic+STT+incremental-audio, feed the meeting
   cue route, single-stream transcript first (imbalance stays silent until diarization).
2. Meeting UI panel (mode selector, start/stop, transcript, cue display, `speakCue` earpiece reuse).
3. The `nearingEnd` signal producer (session elapsed vs scheduled duration, or a "wrap up" control).
4. Apply migration 0237; founder real-call validation.
5. Video/platform-caption attribution (the larger external integration) — deferred after the in-person MVP.

## Team-Sync dependency (flagged to founder)
Team-Sync does not yet exist in the tree; this build reuses the sales `coaching_sessions` infrastructure as the
interim host. When Team-Sync's live-meeting surface lands, the meeting cue route consumes its transcript stream.

## Residual (A36 — what was set aside, ranked by confidence it doesn't matter; the top is examined)

```json
[
  {
    "id": "latency-analyze-only",
    "item": "latency_ms on the persisted cue measures only the server analyze round-trip, not the full client trigger-to-ear latency the sales cue trace captures.",
    "why_skipped": "The server route cannot observe the client settle+tts stages; the end-to-end trace belongs to the client cue loop (Step 6).",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-21T23:25:00+08:00",
    "outcome": "Examined useLiveCoaching this session: its cueTraces already capture settle+llm+tts end-to-end client-side. The server latency_ms is a supplementary coarse figure for Dissect, not the delivery SLA. No change needed for this build; the client trace carries the real number when Step 6 lands."
  },
  {
    "id": "separate-vs-unified-route",
    "item": "Built a separate /meeting-session/[id]/cue route instead of parameterizing the sales /cue route.",
    "why_skipped": "A separate route keeps the live sales cue path byte-identical (zero regression risk); the shared strategy core already dedups the coaching logic.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null
  },
  {
    "id": "nearingEnd-inert",
    "item": "The summarize/wrap triggers read context.signals.nearingEnd, which nothing computes yet, so they are inert.",
    "why_skipped": "Producing nearingEnd needs a scheduled duration or a client wrap control (Step 6/7); documented as pending.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null
  },
  {
    "id": "imbalance-needs-diarization",
    "item": "The imbalance (dominance) monitor needs per-speaker labels; the single-stream MVP leaves it inert.",
    "why_skipped": "It degrades to silent without labels; diarization is the enhancement half of Decision #1, deferred after the in-person MVP.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null
  }
]
```
