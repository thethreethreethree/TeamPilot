# BUILD — CARE readout unbounded-select paging

### Four CARE analytics readouts page the full aggregation (`src/lib/data/care.ts`)
- write-path: N/A (read-only analytics). Each of the four cross-conversation aggregations —
  `fetchCoachRubricReadout` (agent messages → cohort), `fetchVoiceValueReadout` (customer messages → voice
  cohort), the co-pilot-usage readout (agent messages → co-pilot cohort), and the durability readout
  (`support_durability_checks` → per-conversation bucket) — now reads via `fetchAllPaged((from,to) =>
  sb.from(...).select(...).in("conversation_id", ids).<filters>.order("id").range(from,to))` instead of a
  single unbounded `.select()`. Stable uuid-`id` order → range pagination returns every row exactly once;
  fetchAllPaged throws on a read error (fail-loud, replacing two swallowed reads).
- read-path: the downstream classification (Map/Set per conversation) is UNCHANGED — it now just receives the
  complete row set, so on a >1000-row account the cohort split is correct instead of silently truncated. The
  `fetchCoachRubricReadout` DB-mock test (4 conversations, short page) still passes, proving the paged path is
  behaviour-identical for small datasets.
