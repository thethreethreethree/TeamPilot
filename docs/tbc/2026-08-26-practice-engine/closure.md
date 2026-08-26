# CLOSURE — Practice engine (slice 3)

## What shipped
The founder's practice engine (picker: "Roleplay + focus-scoring"). A rep opens the Training tab, hits **Practice** on
one of their own coached focuses, and drills it against the existing AI roleplay — the prospect now creates moments
that test that skill, and the end-review is a **focus-anchored score**: how well the rep applied THAT skill (0-100), an
honest "you didn't get to it this time" when they didn't, and a one-line next-attempt cue. This completes John
Knudtson's original ask (materials/exercises/AI-feedback-as-reps-practice) using the roleplay we already have — no
fork, no schema, the default roleplay untouched.

## Verification (A38)
`npm run check` → EXIT 0 (see check.md). parsePracticeReview unit-locked (5); existing roleplay tests still pass;
typecheck clean; routes deploy-gated (roleplay is auth + company scoped as before).

## The un-named reliance
- **dissectCoachV5 is always controlExempt** (the roleplay LLM path runs day-1 regardless of a company's §3.4 control
  window) — so practice scoring works for a live team. If that ever changed, the honest applied:false / 502-on-empty
  states still hold; a starved response never becomes a fake score.

## Residual (A36 — explicit)
```json
[
  {
    "id": "R1",
    "item": "Practice is stateless — the scorecard shows once and is not stored, so there's no practice history or manager rollup (who practiced, score trend).",
    "why_skipped": "Mirrors roleplay's deliberate stateless design (practice must not pollute real session history/metrics). Manager-visible practice ANALYTICS needs a new schema + an §A18 leader-visibility design pass (a score trend IS behaviour data), worth scoping on its own rather than bolting on here.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-26T15:05:00+08:00",
    "outcome": "OPENED + bounded: the practice LOOP (seed → scored feedback → retry) delivers the founder's value today; persistence/analytics is an additive slice, surfaced not silently skipped."
  },
  {
    "id": "R2",
    "item": "The seed is the raw focus text; the prospect is asked to create moments that test it, but the scenario isn't itself LLM-generated from the focus + the team drill.",
    "why_skipped": "The raw-focus seed already produces a targeted practice against a real coached skill (the category-standard behaviour-shaping). A richer generated scenario is a quality enhancement, not a correctness gap.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null
  }
]
```
