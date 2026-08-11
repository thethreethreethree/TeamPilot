# REMEDIATE — F1 KPI truncation

## F1 — page the seven usage-growth reads
Root cause: `kpi/me` + `kpi/team` paged their sessions read but then read `after_pitch_summaries`,
`coaching_cues`, `coaching_cue_outcomes`, and `coaching_transcript_segments` with a bare unbounded
`.select().in/.eq(...)`, capped by PostgREST at 1000 rows → the reliance/cue/quality aggregations they feed
truncated silently.

Remediation: wrapped all seven reads in `fetchAllPaged` with `.order("id")` on each table's uuid `id` PK
(verified in migrations 0070/0080). Behaviour-preserving except the truncation: `.catch(() => null)` + the
existing `?? []` keep the routes' intended error handling; a <1000-row table ends after one short page (the
integration tests are unchanged). Enumerated EVERY usage-growth read in both routes first (A26) so the fix is
the whole class in these routes — /me had 4 (not the 3 first flagged), /team had 3.

Test added: `kpi/__tests__/paged-reads.test.ts` locks that each of the seven reads sits inside a
`fetchAllPaged(...).range(...)` window and that the segment reads order by `id` — a revert to unbounded fails
the guard. Paging behaviour itself is proven in `paginate.test.ts`.

Outcome: fixed. severity: high (headline honesty metric, likely live-wrong pre-fix). class:
`unbounded_select_silent_truncation_1000cap`, JS-aggregation variant.
