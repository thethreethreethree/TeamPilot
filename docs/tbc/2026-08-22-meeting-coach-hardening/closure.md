# CLOSURE — Meeting Coach client hardening

## What shipped
Three audit fixes to the in-person MVP client (commit 4f5c4538), client-only: the reconnect resource leak
(teardownTransport before rebuild), the error/stop workflow dead-end (endSession returns to setup), and the
theme leak (semantic tokens, theme:audit green). Full `npm run check` exit 0 (3572 tests); no sales/server change.

## The un-named reliance
- **Device confirmation still owns the two logic fixes.** The hook is not unit-testable; the leak fix and the
  dead-end fix are reasoned + typecheck-clean, verified on device with the rest of the client — not by a unit
  test. Only the theme fix is gate-covered.

## Open (unchanged from the MVP closure)
Apply migration 0237 + founder device validation; nav + module gating (needs the product-structure decision —
does Meeting Coach live under Sales Coach or its own Team-Sync section?); diarization; video/platform captions;
meeting audio recording + Dissect.

## Residual (A36 — ranked by confidence it doesn't matter; the top is examined)

```json
[
  {
    "id": "mic-hot-on-terminal-fail",
    "item": "On an exhausted-reconnect terminal STT failure, the mic stream stays open (capture is dead) until the facilitator taps Stop.",
    "why_skipped": "Matches the sales hook's posture (keep the mic while the user decides); a meeting has no recorder to preserve, but auto-killing the mic on a transient-looking error is more surprising than leaving it until an explicit Stop.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-22T00:02:00+08:00",
    "outcome": "Examined the onclose path: on terminal failure it sets an error telling the facilitator to Stop, and endSession tears the stream down. The window is short and user-ended; auto-teardown would race a legitimate manual retry. Left as-is deliberately; revisit only if device testing shows a privacy/battery concern."
  },
  {
    "id": "nearingEnd-no-unset",
    "item": "The 'Wrapping up' control sets nearingEnd true with no way to un-set it in the same session.",
    "why_skipped": "Once a meeting is wrapping up it stays wrapping up; a toggle is a minor refinement, not a correctness issue.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null
  },
  {
    "id": "auto-coach-default-on",
    "item": "Meeting auto-coach defaults ON, whereas Sales Coach defaults auto-coach OFF (founder 2026-07-28).",
    "why_skipped": "A facilitator who started a coached meeting + confirmed an earpiece has already opted into coaching (unlike a rep just recording); the meeting brain's understanding gate keeps it from spamming. Founder-tunable if it feels noisy.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null
  }
]
```
