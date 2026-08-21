# CLOSURE — DoorLog update-reach + honest audio-dropped copy

## What shipped
Two field-driven fixes so the chunked recording fix actually helps reps:
1. **Update reach.** An actively-knocking rep never idled 90s / never backgrounded the app, so a deploy sat
   unreceived for hours (live DB: 19 knocks, 0 pitches in 90 min — the field was stale). DoorLog now marks a
   recording active (VersionWatcher won't reload mid-pitch) and fires `elostate:safe-to-update` on returning to
   idle between doors; VersionWatcher checks fresh + auto-reloads IF stale at that safe moment.
2. **Honest copy (M1).** "recorded no audio" was a lie when the rep DID record and the UPLOAD failed. The note
   now distinguishes `upload_failed` ("the recording couldn't be saved this time — weak signal") from
   `no_capture` ("no audio was recorded").

Client-only; reuses VersionWatcher's tested guards. Full `npm run check` exit 0.

## The un-named reliance
- **On-device reach confirmation.** The auto-reload can't be tested headless. Confirm on a device: with an old
  app open + knocking, after a deploy it reloads to the new build at a door gap (no manual refresh). Immediate
  workaround for the field right now: **fully close + reopen the app** to pull the current build.
- The reach fix only helps once a rep has THIS build; reps on an even-older bundle still need one manual
  refresh to receive it (bootstrapping).

## Residual (A36)

```json
[
  {
    "id": "outcome-window-between-stop-and-save-unguarded",
    "item": "data-recording clears at Stop; if a rep walks away for 90s DURING outcome/naming (before Save), VersionWatcher's idle-timer could reload and lose the un-tagged outcome.",
    "why_skipped": "The rep is actively tapping (pick outcome / type name) during that window, which resets the 90s idle timer; the audio is already durable (chunks). The safe-to-update event only fires on idle-RETURN, never mid-naming.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-22T07:46:00+08:00",
    "outcome": "Accepted for now; a follow-up could hold data-recording (or a 'busy' flag) through Save to fully seal the outcome-tagging window."
  }
]
```
