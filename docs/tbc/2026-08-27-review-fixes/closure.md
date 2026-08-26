# CLOSURE — Review fixes

## What shipped
Three confirmed defects from this session's adversarial reviews, fixed:
- **Practice-scenario auto-fetch loop (HIGH)** — a null/error/rate-limited generation no longer re-triggers the effect
  forever; it now settles to the plain focus seed (one auto-attempt per focus, "New scenario" refetches explicitly).
- **Coaching-material retry (MEDIUM)** — the "couldn't load" state now actually retries when the guide is reopened.
- **Team-brief window label (MEDIUM)** — the displayed brief is labeled by its own window, so toggling Day/Week without
  rebuilding no longer presents a 7-day brief as "the last day".

## Verification (A38)
`npm run check` → EXIT 0 (see check.md). Typecheck clean; the parse-seam tests are unchanged and pass. Both reviews'
refuted hypotheses (tenant scoping, injection fence, the after() write, leader-visibility path, state isolation) were left unchanged.

## The un-named reliance
- **The scenario latch is a ref keyed on focus, not on the fetch result.** So it fires once per focus regardless of
  outcome; a rep who wants another go uses "New scenario" (explicit). This is the intended one-shot-auto behavior.

## Residual (A36 — explicit)
```json
[
  {
    "id": "R1",
    "item": "These UI effect/render fixes have no unit tests (no pure seam); they're verified by reasoning + typecheck + the reviews.",
    "why_skipped": "The project has no render-test harness for these pages; a React effect loop / fetch-on-open condition / label source is not a pure function. Adding a render harness is a broader hardening than this fix.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-27T06:55:00+08:00",
    "outcome": "OPENED + bounded: the fixes are isolated and self-documenting; a render harness for these surfaces is surfaced as future hardening, not silently skipped."
  },
  {
    "id": "R2",
    "item": "Two LOW review notes not acted on: door-activity ignores the brief period window; the pre-generation cron cap of 10 is a scaling ceiling.",
    "why_skipped": "Both are low-severity and pre-existing / bounded (documented); acting on them now is scope creep beyond the confirmed defects. Surfaced for a later pass.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-27T06:55:30+08:00",
    "outcome": "OPENED + bounded: low-severity flags recorded; not blockers."
  }
]
```
