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
  { "id": "R2", "item": "Phases 4–5 — Door Log UI (recorder, KPI strip, offline queue, per-rep toggle) + Report Card UI (period selector, pattern hero, trend chart, pitch list, per-pitch detail).", "why_skipped": "Depend on Phase 3's route/data layer.", "confidence_it_does_not_matter": "low", "opened_at": "2026-08-18T13:01:00Z", "outcome": "BUILT end-to-end. Phase 4: Door Log UI (recorder + 4-state field flow + KPI GET) + offline IndexedDB queue (Q7). Phase 5: rollup worker (rollupWorker.ts generates rep_pattern_summaries per period, wired into the cron's rollup pass) + Report Card UI (period selector, AI pattern hero working/hurting+trend, pitch list) + report-card GET route. Macro Mode is functionally complete: schema→pipeline→Door Log→Report Card. Per-rep toggle built (0219 profiles.macro_mode_enabled + macro-mode GET/POST route + MacroModeToggle on the sales-coach page → reveals Door Log + Report Card links). Full gate passed. Per-pitch detail drill-down BUILT (report-card/[pitchId] GET route + PitchDetail component with scores/summary/strengths/improvements/transcript + failed-state; Report Card pitch list links into it). Desktop nav entry SHIPPED (founder-selected 2026-08-18): the same self-contained MacroModeToggle now renders in the desktop DeckShell (after 'Start a coaching session'), so Macro Mode is reachable from a laptop, not only the mobile-field surface. REMAINING (polish): pipeline integration tests." },
  { "id": "R3", "item": "Storage RLS policies on ASSETS_BUCKET for the pitch-audio path (mirror the pitches select policy).", "why_skipped": "Written against the live bucket definition in the pipeline step (Phase 3).", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-18T13:02:00Z", "outcome": "Phase 3." },
  { "id": "RQ1", "item": "The /doors + /report-card pages' auth (top audit residual — highest confidence-it-doesn't-matter, so OPENED per A36).", "why_skipped": "Assumed inherited from the dashboard/sales-coach layout.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-18T14:00:00Z", "outcome": "RESOLVED — the sales-coach layout has a server-side getUser()+redirect member gate (layout.tsx:52,74) and the dashboard layout gates auth+onboarding; the /doors pages inherit both. Not a hole." },
  { "id": "RQ-F5", "item": "Rollup period window uses UTC recorded_at while KPIs use device-tz local_date (F5, DEFERRED).", "why_skipped": "Correct fix threads per-rep tz into the cron's period computation = redesign; the cron computes one UTC 'today' for all reps. A ≤1-day edge on a rolling window; the KPI strip is the tz-authoritative surface.", "confidence_it_does_not_matter": "medium", "opened_at": null, "outcome": null, "trigger": "when per-rep timezone is available to the rollup (store rep tz or compute the window per-rep)." },
  { "id": "RQ-F8", "item": "spec 5.6 behavioural RLS test (a peer rep cannot read another rep's pitch/transcript/analysis/summary) still absent — the F1 idempotency test shipped, this one didn't.", "why_skipped": "RLS behaviour needs a live DB / verify:live harness, not a unit mock; the policy text is checked (0215) and rls:audit reported 0 tenant-pin risks, but there's no behavioural peer-rep test.", "confidence_it_does_not_matter": "low", "opened_at": null, "outcome": null, "trigger": "add to verify:live (SET ROLE peer rep → SELECT returns 0)." },
  { "id": "RQ-F4", "item": "F4 (skip-transcribe-if-exists) is idempotent-by-existence but has no unit gate.", "why_skipped": "Initially judged not cheaply unit-mockable.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-18T14:30:00Z", "outcome": "GATED — worker.test.ts asserts transcribeSpeech is NOT called when a pitch_transcripts row exists (and IS when absent), via a fake admin client. F4 is now a GATE, not a PROMISE." }
]
```

## Remediation (audit 2026-08-18) — findings ledger, disposition, gates
| # | Sev | Disposition | Fix / reason | GATE/PROMISE |
|---|---|---|---|---|
| F1 pitch-loss on partial-failure retry | HIGH | **FIXED** | `createKnock` returns the id on dedupe (data/doorlog.ts); `createPitch` idempotent on the `knock_id` unique index; route proceeds to `createPitch` even when the knock deduped | **GATE**: `door-log/__tests__/route.test.ts` — "deduped knock STILL creates the pitch" (fails on recurrence) |
| F2 rollup truncation + capped count | HIGH | **FIXED** | rollupWorker orders the LLM sample by `recorded_at desc` (deterministic, recent); displays the REAL total via a separate `count:exact,head:true` query, not the ≤500 sample length | PROMISE (chokepoint: real count query) — a precise gate for "aggregate over a capped select" is a known hole, declined per A33 (limits are legitimate on lists) |
| F3 unvalidated client storagePath → service-role read | MEDIUM | **FIXED** | route rejects a pitch whose `storagePath` isn't prefixed `${companyId}/` (checked buildStoragePath shape, A35) | **GATE**: route.test.ts — "rejects a non-company-prefixed storagePath" |
| F4 retry re-runs paid STT | MEDIUM | **FIXED** | worker gates the transcribe step on transcript-existence, not volatile claim-time status | **GATE**: `worker.test.ts` — "SKIPS STT when a transcript exists" |
| F5 rollup UTC window vs device-tz KPI | MEDIUM | **DEFERRED** | correct fix threads per-rep tz into the cron's period window = redesign, not a minimal edit; a half-fix is syntactically risky + incomplete | residual RQ-F5, trigger below |
| F6 manager Report Card conflation | MEDIUM | **FIXED** | report-card routes filter by `rep_id` (default = caller; optional `?repId=`, RLS still authorizes) | PROMISE (RLS enforces; a manager-picker UI is deferred) → residual |
| F7 raw storage error to client (CWE-209) | LOW | **FIXED** | generic message + server-log the detail | GATE (existing CWE-209 sweep recipe covers the class) |
| F8 missing spec 5 tests | MEDIUM | **FIXED (partial)** | wrote the spec 5.3 offline-idempotency route test (F1's gate) + F3 test; spec 5.6 RLS behavioural test still absent | residual RQ-F8 |

**A35 un-named reliance (checked out loud):** (1) F3 relies on `buildStoragePath` → `${companyId}/…` — confirmed at `assets.ts:194`. (2) F1 relies on `pitches(knock_id)` unique index — confirmed at `0215:57`. (3) F6/report-card rely on the `pitches`/`rep_pattern_summaries` rep+manager RLS (0215/0218) — confirmed applied; `rls:audit` 0 tenant-pin risks.

## Un-named reliance
- The per-pitch analysis reuses the existing sales rubric engine — relies on its output shape mapping cleanly to
  `pitch_analyses` (summary/strengths/improvements/scores); confirmed the shapes align, wiring is Phase 3.
- The rollup's `controlExempt: true` relies on Macro Mode being a day-1 coaching surface (like the rest of the
  Sales Coach), NOT the gated Elostate diagnostic — consistent with salesReview/dissect.
