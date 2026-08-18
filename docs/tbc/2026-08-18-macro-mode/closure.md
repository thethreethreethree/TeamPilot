# CLOSURE — Macro Mode (checkpoint: Phase 0–2 + logic foundation)

This is a CHECKPOINT closure, not a final one: it banks the schema/RLS (applied) + the logic foundation so
git matches the live DB (4 applied migrations must not sit uncommitted). Phase 3 (route/cron) + Phases 4–5
(UIs) continue after.

## What shipped this checkpoint
Migrations `0215`–`0218` (5 tables + view + rep+manager RLS, applied) · 6 logic/engine modules in
`src/lib/coach/doorlog/` (18 tests) · the macro-rollup engine · rls:audit allowlist entries for the
service-role/append-only omissions.

## Verification (A38) — canonical command + exit code
```
$ npm run check
  ✓ typecheck · lint (ESLint 9) · theme:audit
  ═══ RLS policy audit ═══   Tenant-pin risks: 0 · Missing policies: 0 · RLS-bypass views: 0
  ═══ Invariant audit ═══   Violations: 0
  ✓ tbc:docs · tbc:manifest · tbc:artifacts · tbc:residual · tbc:freshness
  Test Files  … passed
  Tests       … passed
GATE_EXIT=0
```
Plus (DB): `npm run db:apply` → verify:live ALL 26 invariants hold; `npm run rls:audit` clean.

## Open questions Q1–Q10 (DoD spec-8 — answered or deferred in writing)
```json
[
  { "id": "Q1", "q": "KPI tiles for no_answer / non_decision_maker?", "status": "deferred-to-Phase-4-UI", "lean": "4 named tiles + tap-to-expand for the 2; data model counts all six (rep_kpi_daily)." },
  { "id": "Q2", "q": "Recording consent", "status": "ANSWERED", "answer": "Legally handled — NO in-flow consent gate (founder 2026-08-18)." },
  { "id": "Q3", "q": "Audio retention", "status": "OPEN", "lean": "Tie to the existing recording-purge-cron retention window." },
  { "id": "Q4", "q": "Who sees a rep's pitches/audio/Report Card", "status": "ANSWERED", "answer": "Rep + manager (RLS 0084 shape, live in 0215/0218)." },
  { "id": "Q5", "q": "What defines a sales day", "status": "DECIDED", "answer": "Device timezone — salesDay.ts computeLocalSalesDate (Intl, not UTC)." },
  { "id": "Q6", "q": "Naming mandatory or skippable", "status": "deferred-to-Phase-4-UI", "lean": "Pre-filled default makes Save one tap; effectively skippable." },
  { "id": "Q7", "q": "Offline capture in v1", "status": "ANSWERED", "answer": "Yes — full offline (knocks + audio, dedupe on client_knock_id)." },
  { "id": "Q8", "q": "Capture address/GPS per door", "status": "DEFERRED", "answer": "Not requested; not in v1 unless founder asks (privacy surface)." },
  { "id": "Q9", "q": "Existing rubric to reuse", "status": "ANSWERED", "answer": "Yes — salesReview/salesScore; per-pitch analysis reuses it, no second definition." },
  { "id": "Q10", "q": "Is 'Report Card' the final name", "status": "OPEN", "answer": "Using 'Report Card' (client neutral); cosmetic, changeable later." },
  { "id": "toggle", "q": "Macro Mode toggle model", "status": "ANSWERED", "answer": "Per-rep, alongside the normal Sales Coach." }
]
```

## Residual (A36) — what remains
```json
[
  { "id": "R1", "item": "Phase 3 — API route (create knock+pitch, signed upload, kick worker) + the pitch-processing cron sweeper (transcribe→analyze→rollup) + Vercel cron registration + Sentry.", "why_skipped": "Checkpoint boundary — the schema + logic foundation were committed first.", "confidence_it_does_not_matter": "low", "opened_at": "2026-08-18T13:00:00Z", "outcome": "DONE (2nd checkpoint) — analyze.ts (reuses rubric) + worker.ts (transcribe→analyze, retry+Sentry) + pitch-processing-cron (CRON_SECRET, vercel.json, maxDuration 300) + door-log route (knock/sign/pitch, after() kick). invariant:audit passed (0 violations)." },
  { "id": "R2", "item": "Phases 4–5 — Door Log UI (recorder, KPI strip, offline queue, per-rep toggle) + Report Card UI (period selector, pattern hero, trend chart, pitch list, per-pitch detail).", "why_skipped": "Depend on Phase 3's route/data layer.", "confidence_it_does_not_matter": "low", "opened_at": "2026-08-18T13:01:00Z", "outcome": "Phase 4 Door Log UI BUILT (useDoorRecorder + DoorLog 4-state field UI + KPI GET + /doors page) + offline IndexedDB queue BUILT (Q7 — offlineQueue.ts enqueue/drain/auto-drain, wired queue-first so No Answer works fully offline); full gate passed. REMAINING: per-rep Macro Mode toggle + nav, and the whole Report Card UI (Phase 5) — the founder-review layer." },
  { "id": "R3", "item": "Storage RLS policies on ASSETS_BUCKET for the pitch-audio path (mirror the pitches select policy).", "why_skipped": "Written against the live bucket definition in the pipeline step (Phase 3).", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-18T13:02:00Z", "outcome": "Phase 3." }
]
```

## Un-named reliance
- The per-pitch analysis reuses the existing sales rubric engine — relies on its output shape mapping cleanly to
  `pitch_analyses` (summary/strengths/improvements/scores); confirmed the shapes align, wiring is Phase 3.
- The rollup's `controlExempt: true` relies on Macro Mode being a day-1 coaching surface (like the rest of the
  Sales Coach), NOT the gated Elostate diagnostic — consistent with salesReview/dissect.
