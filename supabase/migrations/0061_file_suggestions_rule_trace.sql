-- 0061 — Add rule_trace to file_classification_suggestions
-- so the §4 readout can surface "which rules fire most often"
-- across the deterministic file router (autoRouteFile).
--
-- Per the inspection closure 2026-06-19-deterministic-file-routing.md
-- section 7 — the autoRouteFile() function returns a `ruleTrace`
-- array (e.g., ['R1:task=...', 'R2:task-dept-inherit=...']) but
-- the previous schema had no column to store it. The §4 readout
-- referenced it as a stub. This column closes that gap.
--
-- Constitutional sources (§0.1 precondition):
--   • §A12 — idempotent: ADD COLUMN IF NOT EXISTS is safe to
--     re-run.
--   • §3.1 — the trace is a derived fact (which deterministic
--     rules fired); writing it is append-only via INSERT alongside
--     the suggested_* columns; the audit row itself is treated as
--     append-only (no UPDATE to the trace after the user acts).

alter table file_classification_suggestions
  add column if not exists rule_trace text[] not null default '{}';

comment on column file_classification_suggestions.rule_trace is
  'Human-readable trace of which deterministic routing rules fired
   when this suggestion was computed by autoRouteFile(). Example:
   {"R1:task=...","R2:task-dept-inherit=...","R4:title-from-filename"}.
   Used by the §4 readout to surface "which rules fire most often."
   Per §A11 — surface counts, not judgments.';

-- ─── End migration 0061. ────────────────────────────────────
