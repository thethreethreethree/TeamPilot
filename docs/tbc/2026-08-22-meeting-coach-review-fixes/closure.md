# CLOSURE — Meeting Coach client review-fix pass

## What shipped
Four correctness fixes from an independent adversarial review of the untestable meeting client, each mirroring a
proven `useLiveCoaching` guard the fast port had dropped: cross-session cue isolation (epoch + latch reset),
bounded reconnect (stable-open budget refill), cue-status feedback (no dead button), and per-session state
hygiene. Client-only; full `npm run check` exit 0 (3572 tests); no sales/server change.

## The un-named reliance
- **Device confirmation.** The hook is not unit-testable; the fixes are reasoned + gate-clean and each is the
  sales hook's already-device-proven guard, but the meeting hook's specific wiring is confirmed on a real run.
- **The review's coverage.** One independent reviewer found four bugs; a second pass or the device run could
  surface more. The server/data layer was reviewed clean.

## Open (unchanged)
Apply 0237 + device validation; nav + module gating (product-structure decision); diarization; video/platform
captions; post-meeting Dissect (the founder measurement decision). Two docs (architecture reference + device-validation
protocol) are written and pending a separate docs commit.

## Residual (A36 — ranked by confidence it doesn't matter; the top is examined)

```json
[
  {
    "id": "start-checks-only-unmounted",
    "item": "start() checks only unmountedRef (not stoppedRef) after its awaits, so tapping Stop during the token/ctx setup can let start() rebuild on a torn-down stream and flip status back to live.",
    "why_skipped": "The sales hook has the IDENTICAL pattern; diverging one side creates an inconsistency without a proven-better behavior, and the window is a sub-second race the user rarely hits.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-22T00:27:00+08:00",
    "outcome": "Examined both hooks: useLiveCoaching L1104/1191/1211 check only unmountedRef too. This is a shared latent issue, not a meeting regression. Fixing it belongs in a coordinated pass across BOTH hooks (add a stoppedRef check after each await) so they stay aligned — filed as a shared follow-up rather than a one-sided meeting change."
  },
  {
    "id": "auto-coach-default-on",
    "item": "Meeting auto-coach defaults ON vs sales OFF (unchanged this pass).",
    "why_skipped": "A facilitator who started a coached meeting + confirmed an earpiece has opted in; the understanding gate prevents spam. Founder-tunable.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null
  }
]
```
