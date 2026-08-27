# CLOSURE — usage roster audio-capture honesty

## What shipped
A §3.4 honesty fix on the founder's usage-monitoring roster. The `team-activity` route already computed `withAudio`
(how many of a rep's sessions captured a recording) and the roster type carried it, but the annotation rendered only
the session count — so a rep who was active while every capture failed (the iOS webm-stub class the diagnostic showed
across the monitored reps) read as "44 sessions · last active 2d ago", healthy. The roster now shows
`"… · N with audio · …"` and flags the all-failed case as `"⚠ none with audio"`, so the failure the founder needed to
catch is visible in the exact surface built to catch it.

## Verification (A38)
`npm run check` → EXIT 0 (see check.md). A render test gates the honesty (withAudio=0 → warning; healthy → count);
typecheck clean. No route/schema change — the signal was already computed.

## The un-named reliance
- **jsdom + a mocked aggregate is not the live roster.** The test proves the annotation surfaces the signal; that a
  real rep's failed captures render "⚠ none with audio" in production is founder visual-verify — the same reliance as
  the view-session build's real-data check.
- **withAudio counts a stored recording pointer (`audio_asset_url`), not transcription success.** A session with a
  recording that later failed to transcribe still counts as "with audio". That is the honest, available signal at the
  roster level; per-session detail (transcript/review) remains the drill-in for deeper truth.

## Residual (A36 — explicit)
```json
[
  {
    "id": "R1",
    "item": "The all-failed flag is per-rep at the roster level; there is no company-wide 'X% of sessions captured audio this week' rollup.",
    "why_skipped": "A per-rep at-a-glance warning is what a manager acts on; a company rollup is additive over the same team-activity aggregate, not a correctness gap.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-27T09:58:00+08:00",
    "outcome": "OPENED + bounded: per-rep honesty delivers the monitoring value today; a rollup is additive."
  }
]
```
