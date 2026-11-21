# BUILD - RSS Phase 0, steps 1-8

### Reporting tree: set a member's manager (Phase 0 step 3, Gong F2.4)

- **write-path:** `src/app/api/team/set-manager/route.ts` (company admin, service role, company-pinned read and
  write; `assertValidManager` from `src/lib/coach/remote/access.ts`) → `profiles.manager_id`, added by
  `supabase/migrations/0272_rss_p0_foundations.sql` with the `rss_guard_manager` trigger and the extended
  privileged-column guard.
- **read-path:** `src/app/api/team/managers/route.ts` → `src/app/dashboard/team/page.tsx` ("reports to X" on
  each row; a "Reports to" picker for admins beside the role picker).

### Access rule and helpers (used from Phase 0 step 8 on)

- **write-path:** none; functions only, in `supabase/migrations/0272_rss_p0_foundations.sql`.
- **read-path:** `rss_can_view_rep()` is used by the 0272 select policies on `pitch_score_provenance` and
  `pitch_score_archive`; its TS mirror `canViewRep` / `managerChain` in `src/lib/coach/remote/access.ts`.

### Tables created now, wired in steps 5-7

- **write-path:** `pitch_score_provenance`, `pitch_score_archive` (step 5, re-score), `login_attempts` (step 7,
  sign-in route), `ai_usage` / `ai_prices` (step 6, LLM chokepoint and vendor back office). Not yet written.
- **read-path:** none yet; nothing in src reads them, so writer:audit has nothing to flag.

### Re-score rule, archive and provenance (Phase 0 step 5, Gong F15.15, F15.8, D3)

- **write-path:** `src/app/api/coach/sales-session/pitch-score/route.ts` POST — `resolveScoreRequest`
  (`src/lib/coach/remote/rescore.ts`) refuses reps (403, dispute hint) and reason-less re-scores; for a
  manager re-score `archivePitchScore` (`src/lib/coach/pitchScore/scoreHistory.ts`) copies the score, evidence
  and provenance into `pitch_score_archive` FIRST, then `scoreSession` runs with `rescoredBy`.
  `scoreSession` writes `pitch_score_provenance` via `recordProvenance` after every store (all three callers),
  with the model and `PITCH_SCORE_PROMPT_VERSION` from `src/lib/coach/pitchScore/generatePitchScore.ts`.
- **read-path:** the route's response (`rescored`, `earlierOverrides`) → `RescoreControl` in
  `src/components/sales-coach/PitchScorePanel.tsx` ("Re-score this pitch", managers only, reason required;
  says the old score is kept and how many earlier overrides were not carried over). The archive and provenance
  tables have select policies (rss_can_view_rep) but no screen reads them yet.

### AI cost ledger and vendor cost view (Phase 0 step 6, Gong F28.7)

- **write-path:** `src/lib/llm/index.ts` `llmCall` → `metered()` → `recordAiUsage` in
  `src/lib/llm/usageLedger.ts` → `ai_usage` (one row per answered call, provider/model of the provider that
  answered, attribution from `LlmCallArgs.attribution`). Attribution threaded through `runBrainCall`
  (`src/lib/brain/index.ts`), `src/lib/claude.ts`, `generatePitchScore` (engine `pitch_score`, session) and
  `scoreSession`. Prices: `src/app/api/admin/ai-cost/prices/route.ts` POST → `ai_prices`.
- **read-path:** `src/app/api/admin/ai-cost/route.ts` (vendor only; one UTC day, capped at 1,000 rows and
  says so) → `costReport` in `src/lib/coach/remote/costReport.ts` (with `costOf` from
  `src/lib/coach/remote/cost.ts`) → `src/app/dashboard/admin/ai-cost/page.tsx`, linked as "AI cost" (vendor
  only) in `src/components/layout/Sidebar.tsx`.

### Sign-in through the server, attempts recorded (Phase 0 step 7, Gong F1.5)

- **write-path:** `src/app/login/page.tsx` and `src/app/sales-coach/login/page.tsx` → `signInViaServer`
  (`src/lib/auth/signInViaServer.ts`) → `src/app/api/auth/sign-in/route.ts` → `login_attempts` (every attempt,
  lower-cased email, IP, success) and the Supabase session cookies; lockout via `evaluate()` in
  `src/lib/coach/remote/lockout.ts` (NotDecidedError → continue until D4).
- **read-path:** the route reads the last 24 h of attempts for the email before checking the password; the
  login pages show the route's message as they showed Supabase's before.

### Reporting tree switch and alert routing (Phase 0 step 8, Gong F3.2, F16.1)

- **write-path:** none new; `profiles.manager_id` (step 3) is what switches a company.
- **read-path:** `supabase/migrations/0273_rss_p0_tree_switch.sql` — `rss_tree_active`, `rss_tree_allows`, and
  the recreated select policies on coaching_sessions, coaching_transcript_segments, coaching_cues,
  pitch_scores, pitch_score_elements, pitch_score_events, pitch_score_overrides, patterns, pattern_events,
  recording_comments, recording_share_events, pitch_score_provenance, pitch_score_archive.
  `src/lib/coach/gamification/notify.ts` asks `rss_tree_active` and sends alerts up `managerChain` when true.

## Plan files

- `docs/rss/` — the build plan as delivered (README, README-PLACEMENT, BUILD-PLAN/, docs/), with the D1-D3
  decisions recorded in `docs/rss/BUILD-PLAN/00-BRIEF.md` (log) and `docs/rss/docs/00-OPEN-DECISIONS.md`.
- `docs/rss/scaffold/` — the scaffold's src, tests and migrations, as reference; not compiled, tested or applied.
- `src/lib/coach/remote/decisions.ts` (D1-D3 recorded), `src/lib/coach/remote/access.ts`,
  `src/lib/coach/remote/__tests__/access.test.ts` (ported, imports fixed).

## Other files

- `scripts/rls-audit.mjs` — reasons for every operation the 0272 tables deliberately have no policy for.
- `src/app/api/team/set-manager/__tests__/route.test.ts`.
- `src/app/api/coach/sales-session/pitch-score/__tests__/route.test.ts` (existing tests adapted: the caller
  client now answers the existing-score lookup; seven re-score cases added),
  `src/lib/coach/pitchScore/__tests__/scoreHistory.test.ts`, `src/lib/coach/remote/__tests__/rescore.test.ts` (ported).
- `src/lib/llm/__tests__/usageLedger.test.ts`, `src/lib/coach/remote/__tests__/costReport.test.ts`,
  `src/lib/coach/remote/__tests__/cost.test.ts` (ported).
- `src/lib/auth/__tests__/signInViaServer.test.ts`, `src/app/api/auth/sign-in/__tests__/route.test.ts`,
  `src/lib/coach/remote/__tests__/lockout.test.ts` (ported), `src/lib/coach/gamification/__tests__/notify.test.ts`
  (fake gains `rpc`; three tree cases added).
- `scripts/invariant-audit.mjs` — the sign-in route in INVARIANT 18's public list and two INVARIANT 29
  exceptions for login_attempts (pre-auth, no tenant), each with its reason.
- `scripts/invariant-audit.mjs` — INVARIANT 29 exceptions for the four vendor-only, cross-tenant-by-design
  statements in the ai-cost routes (ai_prices read/write, company names), each with its gate.

## Removed (founder picker 2026-11-15)

The off-plan call-page build (uncommitted): /calls pages, /api/calls, /api/trackers, src/lib/insights,
src/components/calls, its migration and build record; the small edits it made to RecordingsTab,
PitchScorePanel, the Settings page, scoreSession and readRecordings were restored to HEAD.
