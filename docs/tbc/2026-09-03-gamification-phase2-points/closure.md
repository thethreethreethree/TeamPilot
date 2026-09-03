# CLOSURE — Gamification Phase 2 (points mapping + orchestrator)

## What shipped
The mapping from an already-scored session to banked points: `computeSessionPoints` (pure — mean of the existing
dimension scores × 10 → 0–100 + band, or null) and `bankSessionPoints` (the only DB side effect — reads the
after-pitch scores, banks one idempotent session_score ledger row, honest empties, real errors propagate). No
second judge (reuse decision); no wiring yet (Phase 3). 17 tests + typecheck clean.

## Verification (A38)
`npx vitest run src/lib/coach/gamification/` → 17/17; `npm run typecheck` clean. Pasted in check.md.

## The un-named reliance
- Relies on the Phase-1 unique index (one session_score per session) for idempotency — bankSessionPoints reports
  the 23505 as already_banked rather than re-inserting.
- Relies on after_pitch_summaries.payload.scores being ScoreCategory[] (the shape salesScore.ts produces) — if that
  scorer changes its output shape, computeSessionPoints must be updated in lockstep (they share ScoreKey).

## Residual (A36 — explicit)
```json
[
  {
    "id": "GAM-R3",
    "item": "computeSessionPoints weights every counted dimension equally, including the two COMPUTED ones (talk_ratio, question_rate) alongside the LLM-judged ones. That is a defensible default but a design choice; per-dimension weighting is the plan's D3 (not built).",
    "why_skipped": "Equal weighting matches the plan's v1 + the DECISIONS reuse; weighting is a separate founder decision.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-03T11:38:00+08:00",
    "outcome": "OPEN — revisit if the founder wants judged vs computed dimensions weighted differently (D3)."
  }
]
```
