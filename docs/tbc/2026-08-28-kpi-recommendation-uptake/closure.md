# CLOSURE — Recommendation uptake (Task 3, part 3)

## What shipped
The KPI Analytics "Recommendation uptake" tile — dead ("building" forever) — now computes a real Layer-4 metric:
of the sessions that surfaced a flagged coachable focus, the share whose NEXT session moved that dimension toward
the healthy middle. Deterministic from stored scores (no LLM), so it's free and measures downstream CONSEQUENCE,
not "the rep agreed" (§3.5). It's the product's coaching-works differentiator (§4/§3.6) made visible.

## The catch that mattered (§0)
The two flaggable dimensions score in OPPOSITE directions (talk_ratio: higher=worse; question_rate: higher=better).
A naive "score went up = uptake" would have counted a rep who talked EVEN MORE as taking the advice — an inverted
metric. Reading salesScore.ts before computing caught it; the direction is now encoded and tested both ways.

## Verification (A38)
`npm run check` → EXIT 0 (see check.md). Direction + dedup + ordering + gates are unit-gated (+7 cases). Verified
against live prod: Moses 13/22, Johns 4/5 (direction-aware). The tile rendering is founder visual-verify.

## The un-named reliance
- **FOCUS_IMPROVEMENT_DIR duplicates salesScore.ts's flag set + directions.** A comment ties them. A new flaggable
  dimension added there WITHOUT a direction here is safely SKIPPED (excluded, honest), never miscounted — drift is
  safe-by-construction, but a genuinely new direction would need adding here to be measured.
- **Only talk_ratio + question_rate are evaluated today** — the only dimensions the engine flags. A free-text focus
  (no flagged score) starts no pair. Honest coverage, not a hidden gap.
- **The metric gates until evaluable pairs accrue** — correct §3.4 behavior; only Moses + Johns clear today.

## Residual (A36 — explicit)
```json
[
  {
    "id": "R1",
    "item": "Two KPI tiles remain unbuilt: Sales cycle length + Follow-up rate. Both need prospect-identity capture (link the same prospect across visits), which the data model lacks.",
    "why_skipped": "Blocked on new capture; a separate foundational build the founder can pick next.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-08-28T07:35:00+08:00",
    "outcome": "OPEN — build prospect-identity capture to unlock both, or honesty-relabel the two dead tiles."
  },
  {
    "id": "R2",
    "item": "Objection-history backfill (from part 2) still open — the objections metric fills as sessions re-analyze; a forced LLM backfill would populate it now (founder cost decision).",
    "why_skipped": "Gating until re-analysis is correct §3.4 behavior; a bulk backfill is a cost decision.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-28T07:35:00+08:00",
    "outcome": "OPEN — offer a costed backfill if the founder wants objection + uptake numbers populated now."
  }
]
```
