# CLOSURE — Meeting Coach UI audit fixes

## What shipped
The confirmed **UI** findings from the founder-directed Meeting Coach audit, each read back against the code first:
H1 (no false "review ready" / dead-end after a session that never recorded), H2 (Start flushes the prep so it's
never bound empty), M1 (autosave failures surfaced), M2 (accents legible in light mode via the codebase's
`text-{c}-700 dark:text-{c}-300` idiom), M3 (Prep-up rows/dropzone use theme tokens, not white-on-white), M4
(keyboard-reachable upload), M5 (no duplicate heading), plus L3/L4/L5 (review Retry gated + a back link; a real
tap target). +2 regression tests. UI-only; full `npm run check` exit 0.

The backend/integration/security findings — the HIGH clean-Stop audio loss, the UUID-coverage silent no-op, the
prep-link silent no-op, huddle-ignores-agenda, the meetingPrep error-as-no-data honesty gaps, and the doc-upload
chokepoint bypass — ship as the **backend/wiring remediation** commit next.

## The un-named reliance
- **H1 / M2-M3 are visual glue** — confirmed by reading + the render tests; a founder eyeball in light mode is the
  final visual check. The accent fix follows the verified codebase idiom, so the risk is low.
- **H2's flush** relies on the debounce being the only un-persisted state; a save FAILURE now blocks Start (so an
  unsaved prep can't silently start), which is the intended trade (a transient failure delays Start, doesn't lose data).

## Residual (A36)

```json
[
  {
    "id": "meeting-coach-backend-remediation-next",
    "item": "The HIGH clean-Stop audio-loss + coverage/prep-link no-ops + honesty gaps + doc-upload hardening are not in this UI commit.",
    "why_skipped": "Kept UI and backend fixes in separate commits so a regression in one isn't entangled with the other; the backend set ships next.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-08-23T08:20:00+08:00",
    "outcome": "Next commit: meeting-coach backend/wiring remediation."
  },
  {
    "id": "ui-low-followups",
    "item": "L1 (a draft prep created on every /prep visit), L2 (Start enabled with an empty prep + no hint), L6 (a forced-cue failure shows the raw HTTP status), L7 (pending-audio 'try again' with no terminal state once the clean-Stop stitch bug is fixed).",
    "why_skipped": "Lower-severity polish; L2 partly mitigated by H2 (Start now persists whatever's there). Batch into a follow-up.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-23T08:20:00+08:00",
    "outcome": "Tracked; the audit report will list them."
  }
]
```
