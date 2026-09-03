# CLOSURE — Gamification Phase 6 (calibration tool)

## What shipped (in code)
The calibration tool — the honesty gate the whole gamification feature rests on. A manager hand-scores a real,
ANONYMIZED transcript BLIND on the five judged dimensions, submits, and sees the model's scores + a running
per-dimension agreement report. It makes the AI score falsifiable against an independent human BEFORE it drives any
rank — the structural answer to §3.5's "measuring agreement instead of consequence is grading your own homework."
Built: migration 0244 (append-only manager-read store), a pure `computeCalibration`, a blind-then-reveal
service-role route (manager-gated, transcript anonymized to REP/PROSPECT), and a UI (nav item + page + component).

## Verification (A38)
6 pure-logic tests + 4 route tests (incl. the 403 gate and the anonymization assertion) + 16 nav tests + typecheck
clean + a rendered-PNG visual check. All in check.md. HONEST unmet precondition: `npm run db:apply` did NOT run
(network down) — migration 0244 is written but not live, and nothing is pushed. These are named, not hidden.

## The un-named reliance
- Relies on the route being the ONLY writer to gamification_calibration (no client write policy) so the append-only
  + manager-gate can't be bypassed by a direct PostgREST call.
- Relies on the transcript builder being the single place a rep identity could enter the manager's view — it emits
  speaker-role only, so A18 anonymization holds as long as no other field carrying a name is added to `next`.
- Relies on after_pitch_summaries.payload.scores using the same dimension keys the rubric defines (opener/objection/
  tone/close/next_step) so modelScores lines up with the human's blind scores.

## Residual (A36 — explicit)
```json
[
  {
    "id": "GAM-R8",
    "item": "Migration 0244 is written but NOT applied (network outage this session). The route + UI ship in code but the feature is dead until the table exists.",
    "why_skipped": "Blocked by the network outage (Supabase pooler unreachable); applying it is a mechanical `npm run db:apply` once connectivity returns.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-03T13:12:00+08:00",
    "outcome": "OPEN — run `npm run db:apply` when the network recovers; verify 0244 in the ledger + the invariants still hold."
  },
  {
    "id": "GAM-R9",
    "item": "Phase 6 MEASURES and SURFACES score trust; it does not yet ACT on it (a failing dimension still drives the leaderboard). The gate that suppresses/weights an untrustworthy dimension is not built.",
    "why_skipped": "That gate needs real calibration data to set a threshold honestly; building it before the founder runs a calibration would be a fabricated verdict (§3.4).",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-03T13:12:00+08:00",
    "outcome": "OPEN — once the founder hand-scores ~20 transcripts, decide whether/how a failing dimension is down-weighted on the board."
  },
  {
    "id": "GAM-R10",
    "item": "The GET picks the next transcript to score by iterating the model-scored sessions and taking the first un-scored one with >=4 segments; order is Map-insertion (after_pitch fetch order), not randomized.",
    "why_skipped": "Adequate for a manager working through a pool; a deliberate sampling strategy (random / stratified by band) would be a refinement, not a correctness fix.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-03T13:12:00+08:00",
    "outcome": "OPEN — consider randomized/stratified sampling if calibration coverage skews."
  }
]
```

## Deploy note
Gamification Phases 1-6 are local commits on `mobile-bearer-shim` (network outage blocked pushes). When the network
returns: apply 0244, push, and open a dedicated gamification PR (suggested — keep it separate from the mobile-bearer
shim) so the feature deploys as a reviewed unit. The migrations 0242/0243 are already live; 0244 is the only unapplied one.
