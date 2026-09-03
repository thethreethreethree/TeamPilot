# CLOSURE — Gamification Phase 3 (wire + backfill)

## What shipped
Points now bank automatically: `generateAndStoreAfterPitch` (the one sequence both the on-view route and the
recovery backfill run) calls `bankSessionPoints` after saving the score — best-effort, idempotent, no LLM, so a
points failure never breaks the review. Plus a `backfillSessionPoints` companion + a live seed that banked 131
rows from the already-scored sessions (9 agents on the board, top total 3604). Drift-guard tests pin that the wire
fires (and never sinks the save). 22 tests + typecheck clean; live seed confirmed.

## Verification (A38)
`npx vitest run` → 22/22; `npm run typecheck` clean; live seed applied (131 banked) + ledger confirmed. In check.md.

## The un-named reliance
- Relies on generateAndStoreAfterPitch remaining the single after-pitch generation site (A16) — both callers use
  it, so the one wire covers both; if a third path generated a summary without it, that path would not bank.
- Relies on bankSessionPoints's idempotency (the Phase-1 unique index) so the inline wire + the backfill never
  double-bank the same session.

## Residual (A36 — explicit)
```json
[
  {
    "id": "GAM-R4",
    "item": "The inline wire runs bankSessionPoints synchronously within generateAndStoreAfterPitch (fast — a DB read+insert). If it ever became slow it would add latency to the after-pitch generation. Today it is negligible and best-effort.",
    "why_skipped": "No LLM, sub-100ms; moving it to after()/a cron is unwarranted complexity now.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-03T11:55:00+08:00",
    "outcome": "OPEN — move to after() only if profiling ever shows it matters."
  },
  {
    "id": "GAM-R5",
    "item": "No cron re-runs backfillSessionPoints. A live session whose inline bank failed (logged) would not self-heal until the function is re-invoked. The failure is logged + idempotent, so a periodic sweep would close it.",
    "why_skipped": "Inline bank failures should be rare (best-effort on a fast DB op); a cron is a fast follow if they appear.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-03T11:55:00+08:00",
    "outcome": "OPEN — add a points-backfill cron (mirror backfill-dissects-cron) if inline failures show up in logs."
  }
]
```
