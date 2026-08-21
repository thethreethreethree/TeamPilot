# CLOSURE — Meeting Coach client (in-person MVP)

## What shipped
The client half (wiring-spec Steps 6–7): a facilitator can create a meeting/huddle session and run a live
coached session end-to-end — mic → Scribe STT → the meeting brain → a cue spoken to the earpiece + shown on
screen. A new self-contained `useMeetingCoaching` hook (zero changes to the sales hook), the `MeetingCoachingPanel`,
a dashboard page, and the `createSession` sessionKind write-safety. Full `npm run check` exit 0 (3572 tests);
Sales Coach untouched.

## The un-named reliance (what this quietly depends on)
- **Device reality.** The hook + panel are not unit-testable; correctness of the mic/WS/audio path (and the
  start-after-create timing, the reconnect ladder, the earpiece playback) is DEVICE-confirmed only. A real
  meeting on a phone with an earpiece is the validation — not yet run.
- **Migration 0237 applied.** No real meeting session exists until `npm run db:apply` runs 0237; the create
  route fails honestly (500 naming the cause) until then.
- **The `/tts` route serving a meeting caller.** `speakCue` reuses `/api/coach/sales-session/tts`; it is
  agent-authed and generic, assumed to serve a meeting facilitator the same as a rep. Confirm on device.

## Open (next)
1. Apply migration 0237; founder device validation (a real in-person meeting/huddle).
2. Nav entry + module-access gating for `/dashboard/meeting-coach` (reachable by URL now; not yet in nav).
3. The `nearingEnd` producer is wired to a manual "Wrapping up" button; a time-based producer is a later refine.
4. Diarization (N-party labels) to activate the imbalance monitor — the enhancement half of Decision #1.
5. Video/platform-caption attribution (the larger external integration) — deferred after the in-person MVP.
6. Post-meeting Dissect of the recorded cues (Phase 6).

## Residual (A36 — ranked by confidence it doesn't matter; the top is examined)

```json
[
  {
    "id": "tts-route-name",
    "item": "The meeting hook speaks cues via /api/coach/sales-session/tts (a sales-named route) rather than a meeting-namespaced one.",
    "why_skipped": "The route is generic text->audio and agent-authed; renaming/namespacing it is cosmetic and would touch the sales path for no behaviour gain.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-21T23:47:00+08:00",
    "outcome": "Examined the sales speakCue + the tts route usage: it takes arbitrary {text} and returns audio, no sales-specific coupling. Reusing it as-is is correct; a later cosmetic namespacing can move both callers together. No change needed."
  },
  {
    "id": "no-incremental-audio",
    "item": "The meeting hook does not record/stitch the call audio (the sales incremental-upload durability), so a meeting has no recoverable recording.",
    "why_skipped": "The MVP goal is live cues; post-meeting audio recovery + Dissect is Phase 6. A huddle is short and cue-focused.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null
  },
  {
    "id": "lean-reconnect",
    "item": "The meeting reconnect is a simple bounded ladder, not the crisis-hardened recorder-continuity/mic-reuse path the sales hook now has.",
    "why_skipped": "Meetings are typically shorter and on a stable room network; the full mobile-lock hardening can be shared when the transport is later extracted.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null
  }
]
```
