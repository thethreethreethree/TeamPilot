# CLOSURE — Team Training Brief engine (slice 1)

## What shipped
The first slice of the founder's training system: a manager-facing TEAM training brief. On the Coach Assessment view,
a manager clicks Build and gets a brief from the last 7 days of pooled coaching signal — the team's recurring growth
patterns (themes), a concrete drill to run in tomorrow's meeting, and one coaching focus per rep — or an honest "not
enough sessions yet." Built from real, frequency-ranked dissect signal; refuses to fabricate below MIN_DISSECTS; per
§A18 the per-rep line is a focus, never a ranking, and a hallucinated rep name is dropped.

## Verification (A38)
`npm run check` → EXIT 0 (see check.md). parseTeamBrief unit-tested (5); typecheck clean; the manager route is gated.

## The un-named reliance
- **debriefCoachV5(controlExempt:true) runs day-1** (the sales-coach path is control-exempt, like salesReview). The
  brief therefore generates for a live team; if that ever changed, the honest below-threshold/empty states still hold.

## Residual (A36 — explicit)
```json
[
  {
    "id": "R1",
    "item": "The brief is generate-on-demand (one LLM call per click), not scheduled/cached, and covers a fixed 7-day window.",
    "why_skipped": "The founder wanted the ENGINE first (this slice); a nightly pre-generation, a 'since yesterday' delta, and a day/week toggle are natural follow-ups on top of it. On-demand delivers the value now without a cron/table.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-26T10:40:00+08:00",
    "outcome": "OPENED + bounded: the engine + manager surface work end-to-end today; scheduling/period-toggle are additive enhancements for a later slice, surfaced not silently skipped."
  },
  {
    "id": "R2",
    "item": "The NEXT slices — the rep-portal Training tab, training materials, and the interactive practice engine (AI feedback as reps practice) — are not built here.",
    "why_skipped": "Founder chose to build incrementally, team-feedback engine FIRST. This slice is the data + manager surface the Training tab will display. The practice engine has real design forks (re-use the live coach? scripted drills?) worth scoping before building.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null
  }
]
```
