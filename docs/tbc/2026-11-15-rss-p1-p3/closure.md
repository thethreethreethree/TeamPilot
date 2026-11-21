# CLOSURE - RSS Phases 1-3

## What is true now (as written, not as run)

Phone is a session channel everywhere a session is started, listed, described to the AI and captured live. A
phone/video session shows its processing stage and, when it stops, why. Phone/video score panels say they were
scored with the door rubric. Managers can create keyword trackers; phone/video calls are matched when their
transcript lands and the session page lists the hits. A finished phone/video call's session page has a player,
talk-time lanes with speaker isolation, the stat strip beside the rep's own averages, and a searchable transcript
whose lines and tracker chips play from their moment. New recorded calls store real end times; older ones are
estimated and say so.

## Residual

```json
[
  {"id": "R1-literal-union-gate", "item": "No gate stops a new literal 'in_person' | 'video' union outside sessionContext.ts.", "why_skipped": "Scope; the sweep is done by hand.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-14T23:20:00Z", "outcome": "Opened: grep for the literal union outside sessionContext.ts returns role-play and Meeting Coach (their own two-option lists by design: D9, meetings) and cueInstrument.ts, whose union already includes phone. No action."},
  {"id": "R2-gate-not-run", "item": "npm run check not run; 0275/0276 not applied.", "why_skipped": "No Node; Supabase suspended.", "confidence_it_does_not_matter": "low", "opened_at": null, "outcome": "OPEN."},
  {"id": "R3-required-outcome", "item": "Phone/video sessions can close without an outcome (plan F25.9).", "why_skipped": "Founder decision 2026-11-15: keep it skippable on every channel.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-15T00:00:00Z", "outcome": "Closed by decision; logged in docs/rss/BUILD-PLAN/00-BRIEF.md."},
  {"id": "R4-completion-notice", "item": "No in-app notice when an uploaded call finishes processing.", "why_skipped": "Needs a new notification type in the 0242 CHECK and the bell's mirror.", "confidence_it_does_not_matter": "medium", "opened_at": null, "outcome": "OPEN."},
  {"id": "R5-rubric-per-channel", "item": "The scorer does not read rubric_config per channel; no N/A per element.", "why_skipped": "A scoring-engine change that must be regression-tested (door score byte for byte); not testable here.", "confidence_it_does_not_matter": "low", "opened_at": null, "outcome": "OPEN."},
  {"id": "R6-phase-2-rest", "item": "Phase 2 leftovers: comment @mentions and visibility (F9.8, a recording_comments change); live capture stores no end times (ElevenLabs realtime word timings not wired); stored stats for sessions processed before 0277 (the session page computes them live meanwhile).", "why_skipped": "Scope of this pass.", "confidence_it_does_not_matter": "medium", "opened_at": null, "outcome": "OPEN."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
