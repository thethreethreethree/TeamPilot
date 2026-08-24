# CLOSURE — "View last pitch result" button after ending a Door Log session

## What shipped
The Macro Door Log gap the founder named ("the session gets stored on another page, so they can't see it
immediately") is closed: after a rep ends a session (saves a recorded pitch), an OPTIONAL "View last pitch
result" link appears in IDLE and opens that pitch's after-pitch result in one tap (server redirect to the newest
pitch's detail), instead of navigating to the Pitch Performance page and finding it.

## Verification (A38)
`npm run check` → EXIT 0 (see check.md). Targeted: 6 new tests green (4 redirect-page, 2 Door Log render) + the
existing `DoorLogFlow` render test re-run green (proves the static-`<Link>` approach added no ripple).

## The un-named reliance (what this build assumes)
- **`recorded_at desc` = the just-ended pitch.** The redirect resolves "latest" by `recorded_at`; a pitch saved
  seconds ago is newest, so the link lands on the pitch the rep just ended. Holds unless a rep somehow has two
  pitches with a later `recorded_at` created between save and tap (not a real field scenario).
- **The detail page handles "still processing."** Tapping right after a save (analysis async) shows the detail's
  own processing state, not an error — relied upon, not re-implemented here.

## Residual (A36 — explicit)
```json
[
  {
    "id": "R1",
    "item": "The link appears only after a pitch is saved THIS Door Log mount (justSavedPitch), not on a fresh open with prior-session pitches.",
    "why_skipped": "This is the founder's literal spec — 'the button needs to appear AFTER they end a session'. A rep who wants an older result still has the Pitch Performance nav tab. Making it always-available on any recent pitch would be a different (broader) ask.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-24T09:24:00+08:00",
    "outcome": "OPENED + CONFIRMED. Re-read the founder's exact words ('after they end a session'); the this-mount trigger is the faithful implementation, not an oversight. If the founder later wants it whenever a recent pitch exists (even on a fresh open), the change is a mount-time check of the latest endpoint — one small addition. Left as-is per the stated spec."
  },
  {
    "id": "R2",
    "item": "Scope is the Macro Door Log only; the regular session flow is untouched.",
    "why_skipped": "Verified the regular flow already auto-navigates to /[id]/after-pitch on end (page.tsx:254) — no gap there. The founder said 'pitch performance' (the Macro term) and 'stored on another page' (the Macro async → Pitch Performance shape).",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null
  }
]
```
