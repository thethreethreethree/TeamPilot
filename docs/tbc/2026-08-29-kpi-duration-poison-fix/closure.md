# CLOSURE — KPI duration poison fix

## What shipped
The founder-reported "32051.9 min" avg session duration is fixed at the root: `conversationDurationSeconds` now
caps the wall-clock at 4h (a backfilled/unclosed session → null, not a 54-day poison), and `avgSessionDurationMin`
averages only over KNOWN durations (a null is excluded from both sum and count, not counted as a 0-min call). The
fix lives in the ONE shared helper (audit F8), so the After-Pitch header, the Sessions list, and the KPI card are
all corrected together. Verified against the LIVE DB (230 sessions with >6h spans, 200+ sharing the 2026-08-21
backfilled ended_at) — not asserted, as it wrongly was last session.

## Verification (A38)
Coach subset: 134 files, 1094 tests. Full `npm run check` on the commit run. Two new tests lock the cap +
the exclusion using the exact live-data shape.

## The un-named reliance
- The 4h cap is a POLICY choice: it assumes no legitimate single coaching session exceeds 4 hours of live
  wall-clock. Uploads (true audio length) are exempt, so a genuinely long recorded meeting is unaffected. If a
  real >4h live session ever exists it would read "unknown" — an acceptable trade vs a 54-day poison.
- The bad `ended_at` data (200+ sessions backfilled to 2026-08-21) is left in place; the code cap neutralizes it on
  every read, so a data migration is not required — recorded as a residual, not a blocker.

## Residual (A36 — explicit)
```json
[
  {
    "id": "KPI-R1",
    "item": "LAYER 1 (sales outcomes) is starved: coaching_sessions.outcome is 90% null and has NO capture path (verified: no route writes it, no UI sets it, door-log outcomes live in a separate door_knocks table with no session link). Layer 1 will stay 'building' until outcome capture exists. This is a missing FEATURE, surfaced to the founder as a decision (add a session-outcome control vs bridge door outcomes vs backfill).",
    "why_skipped": "It is a design decision + a build, not a code bug; the founder must choose the approach. The duration fix (the visible poison) ships independently and immediately.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-08-29T11:00:00+08:00",
    "outcome": "OPEN — founder-gated. The capture feature is the real Layer-1 fix."
  },
  {
    "id": "KPI-R2",
    "item": "200+ coaching_sessions carry a backfilled ended_at (2026-08-21) that is semantically wrong (they never really ended). The code cap neutralizes it for durations, but a cleanup (null those ended_ats, or a proper close) would make the raw data honest.",
    "why_skipped": "The code cap fixes every read surface, so the metric is correct without touching data; data cleanup is nice-to-have.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-29T11:00:00+08:00",
    "outcome": "OPEN — optional data hygiene."
  }
]
```
