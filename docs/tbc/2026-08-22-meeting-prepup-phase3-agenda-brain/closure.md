# CLOSURE — Prep-up Phase 3: the agenda-aware brain

## What shipped
The core of Prep-up: the live Meeting Coach now runs the meeting toward the agenda. The cue route loads the
session's prep (goal + must-discuss topics + document context) and passes it to the brain, which hints the next
uncovered topic, grounds drift in the goal, and — near the end — raises a still-uncovered must-discuss topic
(`uncovered_topic`, high importance). The same LLM call reports which topics it saw covered in the window; the
route accumulates that into the prep's running coverage (no re-nudge, no double-write). Coverage is parsed once
at the shared `parseCueDecision` chokepoint (§2.2) and grounded in the carried topic ids (§3.4/A39). Additive:
sales + prep-less meetings are unchanged. Full `npm run check` exit 0.

## The un-named reliance
- **On-device / live-meeting confirmation.** The brain logic + wiring are unit-tested with a fake LLM; the true
  behaviour (a real DeepSeek call hinting/nudging/alerting on a live transcript) is confirmed at go-live on a
  real meeting — the same device-validation step the Meeting Coach already needs. Migration 0238 must be applied
  first (Prep-up persists nothing until then).
- **Coverage quality depends on the model's per-window judgment.** Accumulation is monotonic (covered stays
  covered); a missed-in-one-window topic is caught in a later window or at wrap. Good enough for the
  uncovered-before-end alert; the wrap pass is the backstop.

## Residual (A36)

```json
[
  {
    "id": "coverage-per-window-not-full-transcript",
    "item": "Coverage is judged per rolling window and accumulated, not re-derived from the full transcript each pass.",
    "why_skipped": "Accumulation across windows converges on whole-meeting coverage without shipping the full transcript every call (cost/latency); the nearingEnd pass is the backstop for the alert.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-22T12:41:00+08:00",
    "outcome": "Accepted; a full-transcript coverage sweep at wrap is a later refinement if a topic is ever missed."
  },
  {
    "id": "huddle-agenda-not-wired",
    "item": "The agenda is wired into the MEETING brain; the huddle brain ignores it.",
    "why_skipped": "A huddle is a fast status round, not an agenda-driven meeting; Prep-up targets meetings. Can extend to huddles if wanted.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-22T12:41:00+08:00",
    "outcome": "Intentional; meeting-scoped for v1."
  }
]
```
