# CLOSURE — Team practice rollup + review fixes

## What shipped
The first pending optional — the **team practice overview** the founder's original feedback asked for: on the manager's
Training tab, a "Team practice" card shows how much the whole team is practising, how many reps are active, the average
score, and how many are improving vs slipping. It's a PURE aggregate — no individual is named or rankable (§A18-safest).
Bundled with two fixes from the practice-analytics correctness review: the per-focus "0" honesty bug (now "not applied
yet"), and a defense-in-depth tenant filter on the manager practice read.

## Verification (A38)
`npm run check` → EXIT 0 (see check.md). +4 tests (Finding-1 null; team rollup honest zeros / aggregate / avg-null);
typecheck clean; no new query (reuses per-rep summaries).

## The un-named reliance
- **The rollup is derived from the per-rep summaries already fetched (200 events/rep bound).** A rep past 200 recent
  practices contributes a bounded-window trend to the aggregate — the same documented bound as the per-rep read, never
  a crash. Acceptable: the team direction is a coaching signal, not an audited statistic.

## Residual (A36 — explicit)
```json
[
  {
    "id": "R1",
    "item": "avgLatest is a simple mean of reps' latest applied scores; no per-skill team breakdown or weighting.",
    "why_skipped": "A single team average + improving/slipping counts is what a manager reads at a glance in the meeting; a per-skill team breakdown is additive over the same events, not a correctness gap.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-27T06:00:00+08:00",
    "outcome": "OPENED + bounded: the aggregate answers 'is the team practising and improving' today; richer breakdowns are additive, surfaced not silently skipped."
  },
  {
    "id": "R2",
    "item": "The remaining pending items (AI-generated scenarios, materials library, brief scheduling) are not built here.",
    "why_skipped": "The founder said 'begin' the optionals; this is the first (team rollup) + the review fixes. The others are separate builds, each surfaced in the client status report as still pending.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null
  }
]
```
