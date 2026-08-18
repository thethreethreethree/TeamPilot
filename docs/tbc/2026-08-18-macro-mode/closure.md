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
  { "id": "R2", "item": "Phases 4–5 — Door Log UI (recorder, KPI strip, offline queue, per-rep toggle) + Report Card UI (period selector, pattern hero, trend chart, pitch list, per-pitch detail).", "why_skipped": "Depend on Phase 3's route/data layer.", "confidence_it_does_not_matter": "low", "opened_at": "2026-08-18T13:01:00Z", "outcome": "BUILT end-to-end. Phase 4: Door Log UI (recorder + 4-state field flow + KPI GET) + offline IndexedDB queue (Q7). Phase 5: rollup worker (rollupWorker.ts generates rep_pattern_summaries per period, wired into the cron's rollup pass) + Report Card UI (period selector, AI pattern hero working/hurting+trend, pitch list) + report-card GET route. Macro Mode is functionally complete: schema→pipeline→Door Log→Report Card. Per-rep toggle built (0219 profiles.macro_mode_enabled + macro-mode GET/POST route + MacroModeToggle on the sales-coach page → reveals Door Log + Report Card links). Full gate passed. Per-pitch detail drill-down BUILT (report-card/[pitchId] GET route + PitchDetail component with scores/summary/strengths/improvements/transcript + failed-state; Report Card pitch list links into it). Desktop nav entry SHIPPED (founder-selected 2026-08-18): the same self-contained MacroModeToggle now renders in the desktop DeckShell (after 'Start a coaching session'), so Macro Mode is reachable from a laptop, not only the mobile-field surface. Offline queue (Q7) GATE-TESTED (founder-selected 2026-08-18): offlineQueue refactored for an injectable QueueStore (production = IndexedDB, unchanged), so the drain's remove-only-on-success invariant is now covered by offlineQueue.test.ts (7 tests: confirmed send removes; FAILED/THROWN send LEAVES the item queued — no lost knock/pitch; oldest-first order; offline → sends nothing). Offline system WITHHELD (founder 2026-08-18): the CLIENT offline queue is put on hold until its build plan/structure is set — DoorLog rewired to ONLINE-ONLY direct POST (noAnswer → POST; save → sign+upload+POST, fire-and-forget so the rep still returns to IDLE with zero waiting; clientKnockId retained so server dedupe holds). offlineQueue.ts + its test preserved DORMANT (no live importer → never bundled → cannot interfere); re-enable = re-wire DoorLog back to enqueue/drain + startAutoDrain. The SERVER pitch-processing pipeline (worker/cron) is untouched. Online-only FAILURE VISIBILITY added (honesty thesis, no-instant-results section): a failed knock/pitch send now surfaces a dismissable red banner ('didn't save — check your connection') instead of silently advancing the flow as if it saved; loadKpi re-fetches the true count to correct the optimistic bump. Closes the 'error dressed as success' gap the online-only rewrite would otherwise open (no client retry means a dropped write must at least be VISIBLE). REMAINING (polish): pipeline integration tests." },
  { "id": "R3", "item": "Pitch AUDIO in ASSETS_BUCKET is protected at COMPANY grain (existing storage RLS = auth_company_id()), while the pitch METADATA tables are REP-grain (rep+manager). A peer rep in the same company is company-authorized for the object path.", "why_skipped": "Not built — and verified 2026-08-18 to be LATENT, not live: audio_path is written once (F3-validated company-prefixed) and read ONLY by the service-role worker (worker.ts:68). There is NO client read path — createSignedUploadTarget registers no assets/files DB row (so /api/files can't list it), no route calls createSignedUrl (no read-signing), and no UI plays pitch audio. So no peer rep can reach another rep's audio through any current code path.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-18T13:02:00Z", "outcome": "RECORDED as a latent finding (proactive adjacent-surface sweep, AMD-006). The gap becomes LIVE the moment a client-facing audio-playback route is built: it MUST prove REP ownership before signing (mirror the report-card rep_id gate — 'prove access BEFORE signing', signed-URL = ungated bearer capability), OR add a rep-scoped storage.objects SELECT policy on the {company_id}/{rep_id}/ prefix. A company-scoped signer alone would leak peer-rep pitch audio while the metadata stayed rep-isolated.", "trigger": "when ANY route signs a pitch audio_path for a client — gate it on rep ownership, not company scope." },
  { "id": "RQ1", "item": "The /doors + /report-card pages' auth (top audit residual — highest confidence-it-doesn't-matter, so OPENED per A36).", "why_skipped": "Assumed inherited from the dashboard/sales-coach layout.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-18T14:00:00Z", "outcome": "RESOLVED — the sales-coach layout has a server-side getUser()+redirect member gate (layout.tsx:52,74) and the dashboard layout gates auth+onboarding; the /doors pages inherit both. Not a hole." },
  { "id": "RQ-F5", "item": "Rollup period window used UTC recorded_at while KPIs use device-tz local_date.", "why_skipped": "Initially deferred as needing per-rep tz storage (a redesign).", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-18T14:30:00Z", "outcome": "FIXED (founder-approved 2026-08-18, no tz storage needed). rollupWorker now (1) windows both the sample and count queries on the knock's device-tz `door_knocks.local_date` (the SAME field the KPI view aggregates) via an embedded !inner filter, not the pitch's UTC recorded_at; and (2) anchors each rep's 'today' to their MAX(local_date) (device-captured) rather than the cron's UTC today, so the day/week boundary matches the rep's own sales day. Gated by rollupWorker.test.ts (3 tests: windows on local_date never recorded_at; anchors to max local_date not UTC today; UTC fallback only when the rep has no knocks). Query shape behaviourally validated against live PostgREST (HTTP 200).", "trigger": null },
  { "id": "RQ-F8", "item": "spec 5.6 behavioural RLS test (a peer rep cannot read another rep's pitch/transcript/analysis/summary).", "why_skipped": "RLS behaviour needs a live DB / verify:live harness, not a unit mock.", "confidence_it_does_not_matter": "low", "opened_at": "2026-08-18T14:00:00Z", "outcome": "PARTIALLY GATED (regression vector closed). The end-to-end behavioural test needs two REAL auth.users (rep_id → auth.users FK, 0215:31) + a live pitch (pitches is empty until reps use the feature), so ephemeral fixtures can't be cheaply built in a rollback txn — that proof stays a residual. BUT the actual regression vector — a future migration WIDENING a pitch-family SELECT policy from rep-owner to company-wide (any colleague reads any rep's pitches), which every tenant-pin check would pass — is now gated: verify:live invariant 'Macro-Mode pitch tables keep the PER-REP owner restriction (F8)' asserts all 5 SELECT quals retain `rep_id = auth.uid()` (the manager clause is `p.id = auth.uid()`, so dropping the owner term is detected). Verified live: 27/27 invariants, the new one green.", "trigger": "the remaining behavioural proof: when prod has real pitch data, add a two-real-user peer-rep read → 0 rows to verify:live." },
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
| F5 rollup UTC window vs device-tz KPI | MEDIUM | **FIXED** (founder-approved 2026-08-18) | rollupWorker windows both queries on the knock's device-tz `door_knocks.local_date` (embedded !inner filter, the field the KPI view uses) instead of UTC `recorded_at`, and anchors each rep's 'today' to their MAX(local_date) — no per-rep tz storage. Behaviourally validated vs live PostgREST (200) | **GATE**: `rollupWorker.test.ts` — windows on local_date never recorded_at; anchors to max local_date; UTC fallback only with no knocks |
| F6 manager Report Card conflation | MEDIUM | **FIXED** | report-card routes filter by `rep_id` (default = caller; optional `?repId=`, RLS still authorizes) | PROMISE (RLS enforces; a manager-picker UI is deferred) → residual |
| F7 raw storage error to client (CWE-209) | LOW | **FIXED** | generic message + server-log the detail | GATE (existing CWE-209 sweep recipe covers the class) |
| F8 missing spec 5 tests | MEDIUM | **FIXED (partial)** | wrote the spec 5.3 offline-idempotency route test (F1's gate) + F3 test; spec 5.6 peer-rep isolation now has a live-policy REGRESSION guard (verify:live asserts all 5 pitch-family SELECT quals keep `rep_id = auth.uid()` — a widening to company-wide fails); the end-to-end behavioural proof (two real auth.users + a live pitch) stays a narrowed residual | **GATE** (regression vector): verify:live invariant #27 "Macro-Mode pitch tables keep the PER-REP owner restriction". Behavioural proof → residual RQ-F8 |

**A35 un-named reliance (checked out loud):** (1) F3 relies on `buildStoragePath` → `${companyId}/…` — confirmed at `assets.ts:194`. (2) F1 relies on `pitches(knock_id)` unique index — confirmed at `0215:57`. (3) F6/report-card rely on the `pitches`/`rep_pattern_summaries` rep+manager RLS (0215/0218) — confirmed applied; `rls:audit` 0 tenant-pin risks.

## Un-named reliance
- The per-pitch analysis reuses the existing sales rubric engine — relies on its output shape mapping cleanly to
  `pitch_analyses` (summary/strengths/improvements/scores); confirmed the shapes align, wiring is Phase 3.
- The rollup's `controlExempt: true` relies on Macro Mode being a day-1 coaching surface (like the rest of the
  Sales Coach), NOT the gated Elostate diagnostic — consistent with salesReview/dissect.

## Operational-access audit (founder-requested 2026-08-18) — "does it work, can all Sales Coach users reach it"
- **Access — SOLID.** Traced every gate a Sales Coach user passes to reach Macro Mode:
  - Middleware module hard-lock (0207): `moduleForPath("/dashboard/sales-coach/doors") = "sales_coach"` by PREFIX
    (moduleAccess.ts:33), so a sales_coach-locked account is ALLOWED into `/doors` — the prefix design auto-covers
    new subpaths, no allowlist to update.
  - Sales-coach layout member gate: `sales_coach_role admin|staff` OR company leader (`CEO/COO/admin`) → enter. The
    `/doors` pages add NO extra gate (inherit the layout). Macro Mode adds no new barrier — it inherits the module
    gate. The only excluded users are not-yet-role-assigned invitees, who have no Sales Coach access at all by
    existing design (unchanged).
  - macro-mode GET/POST route: auth-only + `.eq("id", auth.user.id)` (self, non-privileged column) — works for
    every authenticated member.
  - MacroModeToggle renders UNCONDITIONALLY on both the mobile and desktop sales-coach surfaces (no role wrap).
- **Functioning — SOUND.** Door Log KPI GET returns `{doorsKnocked,sold,goBacks,notInterested}` exactly matching
  what DoorLog consumes; `/doors` + `/doors/report-card` render DoorLog/ReportCard; ReportCard first-run empty
  state is honest ("No pattern summary yet … it builds as pitches come in"); F5 rollup windowing fixed; online-only
  send failures now surface a banner (no silent loss).
- **Finding (LOW) — FIXED.** `getKpiForDay` filtered only on `local_date`, not `rep_id`. For a REP that returned
  their own row (correct); for a MANAGER the rep+manager RLS returned the whole TEAM's rows and the GET summed them,
  so a manager's Door Log KPI strip showed team totals, not their own. The GET handler's own comment ("RLS returns
  only theirs") documented the intended per-caller behavior — a latent gap for managers, not an intentional
  convention (retrospective record-check). Pinned `getKpiForDay` to the caller's `rep_id` (F6-class fix); reps unaffected,
  managers now correct. Full gate re-run: 2978 of 2978 tests pass, 0 failures.
- **Finding (MEDIUM, efficiency/cost) — FIXED.** With the cron firing every minute, `rollupDueReps` re-ran the
  rollup engine for EVERY rep with a completed pitch in the last 24h EVERY sweep — 4 LLM calls each
  (day/week/month/all_time) — even when no new pitch had completed since the last summary. An active rep burned
  ~4 LLM calls/minute for 24h on an unchanged summary. The code comment named the intended fix ("reps whose most
  recent complete pitch is newer than their newest summary would ideally drive this") — a documented v1 shortcut,
  not a convention. Added a pure `isRepDueForRollup(latestPitch, latestSummary)` cost gate (skip a rep whose newest
  summary is already at/after their latest completed pitch) + fetch each candidate's latest summary once; gated by
  3 unit tests in rollupWorker.test.ts. First-time reps (no summary) still always roll up; freshness after
  inactivity is unchanged (already frozen by the 24h candidate window).
- **Finding (HIGH, render/usability) — FIXED.** Founder-surfaced 2026-08-18: the Door Log showed ONLY "No Answer" —
  the core "Record Pitch" button was invisible, making Macro Mode unusable. Root cause (a CLASS the wiring-only
  audit missed): all three Macro Mode full-screen components (DoorLog, ReportCard, PitchDetail) rooted at
  `min-h-screen` (full viewport), but render inside SalesCoachShell's `<main>` = `flex-1 … overflow-hidden` =
  viewport MINUS the fixed bottom nav. Each was taller than main and its bottom CLIPPED with no scrollbar: the
  DoorLog's bottom-most button (Record Pitch, `justify-end`) vanished; ReportCard's pitch list + PitchDetail's
  transcript were cut off. Fixed all three to the proven Home-page shell idiom — `flex-1 min-h-0` (+ `overflow-y-auto`
  on the two scrollable ones) — so they fill main and scroll internally. Verified with a headless render (before:
  clipped; after: both buttons visible). Lesson: the audit checked routes/RLS/shapes but NOT that surfaces RENDER
  usably inside the shell — a render/layout pass is now mandatory. STRUCTURAL GUARD added
  (shellScrollIdiom.test.ts): fails CI if any page/component under either fixed-overlay shell (SalesCoach OR Care)
  reintroduces `min-h-screen`/`h-screen` in markup, so the clip class cannot come back silently. Swept both
  shells — 0 offenders after the fix; the main dashboard (normal scroll) is intentionally excluded.
- **Finding (HIGH, render/usability #2) — FIXED.** Found in the render pass this class prompted: the Door Log's
  NAMING state (name-the-pitch input + "Save & Next Door") was bottom-anchored (`justify-end`), and the fixed
  overlay shell does NOT resize for the mobile keyboard — so when the input focused, the keyboard covered the
  ENTIRE form including Save. A rep could record + pick an outcome but then NOT save the pitch: core flow broken.
  Confirmed with a headless keyboard-overlay render (before: form fully hidden; after: visible above keyboard).
  Fix: the naming state top-aligns (`justify-start`) instead of bottom-anchoring, so it sits above the keyboard;
  the other states keep the thumb-zone bottom anchor. Root also gained `overflow-y-auto` as scroll safety.
- **Finding (HIGH, keyboard class ROOT CAUSE, app-wide) — FIXED (founder-approved).** The render sweep for the
  keyboard class found it wasn't Door-Log-specific: the app viewport declared scale/fit but NOT
  `interactive-widget`, so it defaulted to `resizes-visual` — the soft keyboard OVERLAYS `fixed inset-0` shell
  content instead of resizing the layout. That is the underlying cause of the naming-form bug and puts every
  bottom-anchored input in the fixed shells at risk (confirmed: roleplay's chat composer — same non-scrollable
  root + bottom composer). Every scrollable page (`flex-1 overflow-y-auto`) was already safe (the scroll region
  lifts a focused input above the keyboard). Root-cause fix (founder chose app-wide): set
  `interactiveWidget: "resizes-content"` in the root viewport so the layout resizes when the keyboard opens and
  fixed shells push their bottom content above it — kills the whole class in one place. The Door Log naming
  top-align is kept as defense-in-depth. App-wide keyboard-behavior change → founder to confirm on-device.
