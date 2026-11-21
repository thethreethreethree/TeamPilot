# CLOSURE - RSS Phase 0, steps 1-8

## What is true now (as written, not as run)

The plan is in docs/rss/ with D1-D3 recorded. Migration 0272 (reporting tree, access rule, provenance,
archive, login attempts, AI cost ledger, and the manager_id guard) is written. Admins can set managers on
the Team page through /api/team/set-manager once 0272 is applied. Nobody's visibility has changed. Reps can no
longer re-score through the API; a manager re-score needs a reason, keeps the old version, and reports the
earlier overrides it did not carry over. Every new score records its model and prompt version. Every
answered AI call that reports token usage is recorded in ai_usage, and the vendor "AI cost" page shows cost
per session, company and feature for a day, with "price missing" until prices are entered. Both login pages
sign in through /api/auth/sign-in, which records each attempt (lockout inert until D4), falling back to the
direct sign-in only if the route itself fails. Once every active rep in a company has a manager, that company's
managers see only their own reports' sessions, scores and evidence, and alerts go up the rep's chain.

## Residual

```json
[
  {
    "id": "R1-docs-scaffold-not-compiled",
    "item": "docs/rss/scaffold holds .ts and .sql files that no tool compiles, tests or applies.",
    "why_skipped": "They are reference copies; the live modules land in src/ phase by phase.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-11-14T21:05:00Z",
    "outcome": "Opened: vitest.config.ts includes only src/** and scripts/** __tests__; tsconfig includes src/**; eslint ignores docs/**; migration tooling reads supabase/migrations only. No action."
  },
  {
    "id": "R2-gate-not-run",
    "item": "npm run check has not been run; nothing in this build is executed, and 0272 is not applied.",
    "why_skipped": "No Node on this machine; Supabase suspended.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null,
    "outcome": "OPEN."
  },
  {
    "id": "R3-guard-sql-harness",
    "item": "No executed test proves an authenticated user cannot change their own manager_id while the service role can.",
    "why_skipped": "Needs the SQL harness on a machine with Node and Postgres.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null,
    "outcome": "OPEN."
  },
  {
    "id": "R4-cfo-drift",
    "item": "is_sales_coach_manager() (0252) omits CFO, unlike admin_roles() and the TS authority.",
    "why_skipped": "Changing it widens access on live policies; step 8 replaces those policies.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null,
    "outcome": "OPEN."
  },
  {
    "id": "R7-audit-row-for-rescore",
    "item": "A manager re-score writes no audit_log row; the plan's step 5 asks for one, but audit_log is a Phase 8 table.",
    "why_skipped": "The table does not exist until Phase 8; the archive row records who, when and why meanwhile.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null,
    "outcome": "OPEN."
  },
  {
    "id": "R8-rescore-before-0272",
    "item": "Until 0272 is applied, every manager re-score is refused (503) because the old score cannot be archived first.",
    "why_skipped": "Intended: re-scoring without the archive would destroy history (D3).",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null,
    "outcome": "OPEN."
  },
  {
    "id": "R9-unmetered-calls",
    "item": "Streaming AI calls (llmStream) and speech-to-text audio seconds are not recorded in ai_usage; most engines other than pitch scoring record no engine or session label.",
    "why_skipped": "Providers return no usage on streams; STT is outside llmCall; threading labels through every engine is a follow-up.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null,
    "outcome": "OPEN."
  },
  {
    "id": "R5-segment-end-times",
    "item": "Transcript segments have no end time; the plan's Phase 2 stats need one.",
    "why_skipped": "A Phase 2 decision.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null,
    "outcome": "OPEN."
  },
  {
    "id": "R6-tree-sweep-before-first-company-DONE",
    "item": "Ten manager routes that use the service role (patterns, override, disputes, leaderboard, comment, share, coach-assessment dashboard, calibration, patterns/event) do not apply the tree; and the remaining rep-scoped policies (agent_baseline, agent_point_ledger, growth_record, kpi_snapshot, door_knocks, door_knock_undos, gamification_calibration, rep_day_target, rep_daily_sales_goal, rep_pattern_summaries, pitches, pitch_analyses, pitch_transcripts) are not switched.",
    "why_skipped": "Scope of the first step 8 pass.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-11-14T23:00:00Z",
    "outcome": "Closed 2026-11-15: the ten routes call treeAllowsRep/treeFilterReps or are allowlisted with a reason in INVARIANT 36 (patterns, pitch-score, leaderboard); migration 0274 switches the thirteen remaining rep-scoped policies; gamification_calibration left with a reason (a manager's own grades; its route filters the pool)."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
