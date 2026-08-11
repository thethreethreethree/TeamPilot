# REMEDIATE — CARE readout unbounded-select paging

### F1 — four CARE readouts truncated at 1000 rows
fix: page the full aggregation via `fetchAllPaged` + stable `id` order in all four readouts; the downstream per-conversation classification is unchanged. `src/lib/data/care.ts`.
gate-or-promise: promise. The behaviour-preserving path is locked by the existing `fetchCoachRubricReadout` DB-mock test (proves paging returns the same result on a small dataset). A precise STRUCTURAL gate for "unbounded .select() on a high-growth table" is A33-declined: a grep for `.select()` without `.limit`/`.range` false-flags every legitimately-bounded single-row/`.maybeSingle()`/small-table read, and the row-count-at-risk depends on the table's growth — which a static gate can't know. `fetchAllPaged` (which throws past its maxRows backstop) is the runtime guardrail; the fix is to route high-growth reads through it, enforced by convention + this record, not a noisy detector.
