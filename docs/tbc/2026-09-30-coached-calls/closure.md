# CLOSURE - "scored" means the rubric

## What is true now

A manager sees "coaching grade · 18 coached calls" and "Recordings (n)", two names for two counts, instead of
"18 scored calls" beside "Recordings (0)".

## Residual

```json
[
  {
    "id": "R1-gamification-scored-wording",
    "item": "The weekly digest and Scoreboard say 'scored pitches/sessions' for gamification points; the rubric's Century badge says '100 scored pitches'.",
    "why_skipped": "Outside the founder's decision, which covered the grade's count; surfaced to the founder instead.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-30T02:55:00Z",
    "outcome": "OPEN."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.

## Appended 2026-09-30 — R1 closed

R1-gamification-scored-wording: CLOSED. The founder chose "coached" for the points surfaces; the weekly digest
and Scoreboard were changed and are covered by the same gate.

## Appended 2026-10-01 — a residual about the gate itself

```json
[
  {
    "id": "R2-local-vitest-runner-flake",
    "item": "Twice on 2026-10-01 (about 2 of 9 full runs), `npm run check` on this Windows machine failed with every test file reporting 'Vitest failed to find the runner'; no test ran. The test step alone passed each time, a re-run of the full gate passed, and CI passed on every push.",
    "why_skipped": "Not reproducible on demand; the cause is not established (resource pressure after the database steps is a guess, not a finding).",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-10-01T14:55:00Z",
    "outcome": "OPEN. Every failed attempt is recorded next to the passing one rather than dropped."
  }
]
```

## Residual update (appended 2026-10-02T04:40Z)

- **R2-local-vitest-runner-flake: still OPEN, no recurrence.** Four full `npm run check` runs against
  postgres:16-alpine on this machine since (finished 2026-10-01 19:49Z and 2026-10-02 04:08Z, 04:19Z, 04:25Z), all exit 0
  with every test file run (727-728 files). Now about 2 of 13 full runs in total. Cause still not established.
- 2026-10-08: one more occurrence, on a targeted `npx vitest run` (68 files "failed", no tests ran); the immediate
  rerun ran normally.
