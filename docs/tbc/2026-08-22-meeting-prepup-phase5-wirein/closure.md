# CLOSURE — Prep-up Phase 5: wire-in

## What shipped
The Prep-up loop now connects end-to-end: on the Prep-up screen the facilitator sets the goal + topics + docs,
taps "Start Meeting" → the meeting session is created BOUND to that prep (`markMeetingPrepStarted`) → the live
coach loads the agenda by session_id (Phase 3) and runs the meeting toward it. The meeting-coach setup also
offers "Prep this meeting first →" and shows "✓ Your prep is loaded" when arriving from a prep. Best-effort link
(a meeting never fails to start over a prep link); prep-less meetings are unchanged. Full `npm run check` exit 0.

With this, Prep-up is functionally complete for the in-person MVP: collect (Ph1/2) → agenda-aware live coaching
(Ph3) → connected flow (Ph5). Phase 4 (Dissect agenda coverage) remains as the post-meeting enrichment.

## The un-named reliance
- **Migrations 0237 + 0238 (founder `npm run db:apply`)** — until applied, creating a meeting session (0237) and
  persisting a prep (0238) both fail honestly; nothing is silently lost. This is the go-live precondition.
- **Global nav + module-gating** — deferred to go-live so a pre-migration feature isn't advertised. The loop is
  reachable by URL now (Meeting Coach MVP posture).
- **End-to-end live confirmation** — the full loop (prep → linked session → agenda cues) is unit-tested per hop;
  a real run on a device (post-migration) is the go-live check.

## Residual (A36)

```json
[
  {
    "id": "global-nav-and-module-gating-deferred",
    "item": "No global sidebar entry / module-access gating for Meeting Coach + Prep-up yet.",
    "why_skipped": "Advertising a feature that can't persist pre-migration would be a broken-path exposure; the nav + gating land with the go-live migration apply + device test (the founder's 'first-3' wire-up).",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-22T13:11:00+08:00",
    "outcome": "Deferred to go-live; the loop is reachable by URL now, connected in-page (setup ↔ prep)."
  },
  {
    "id": "phase4-dissect-coverage-pending",
    "item": "The post-meeting Dissect doesn't yet measure agenda coverage (did-we-hit-goal / covered-vs-missed topics).",
    "why_skipped": "Phase boundary — the live loop (the founder's chosen next step) is done; Dissect coverage is Phase 4.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-22T13:11:00+08:00",
    "outcome": "Next Prep-up phase; the prep data + running coverage are already persisted for it to read."
  }
]
```
