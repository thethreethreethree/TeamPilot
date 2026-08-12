# REMEDIATE — F1 KPI cron agent-enumeration truncation

## F1 — enumeration read capped at 1000, dropping agents from the KPI run
Root cause: the agent-enumeration read used a fixed 5000-row cap, which PostgREST enforces at ≤1000. Ordered by
agent_id, a company past 1000 sessions surfaced only alphabetically-early agents; heavy per-agent counts pushed
even the intended first-100 agents past the cutoff. Dropped agents got no kpi_snapshot at all.

Remediation:
1. Page the enumeration via `fetchAllPaged(...).order("id").range(...)` (stable uuid key) — enumerates EVERY
   distinct (company_id, agent_id) — then `[...keys()].sort().slice(0, BATCH_AGENTS)` for the deterministic batch.
   Mirrors the same file's existing loadAllSess paging. Read error → fetchAllPaged throws → caught → existing
   `{ computed: 0, note }` shape.
2. Remove the now-stale compute-cron entry from FALSE_LIMIT_ALLOWLIST (the xu self-cleaning check flagged it once
   the `.limit` was gone — the guard working as intended).
3. Re-key the route test's mock from the removed `.limit()` to the enumeration read's `company_id` select column.

Boundary (A26): BATCH_AGENTS=100 with no cross-run rotation still means agents past the first 100 never get a
snapshot — a separate DESIGN decision, left founder-gated (queue). This fix makes the first 100 correct + complete.

Durable option: a `SELECT DISTINCT agent_id` RPC (fetches only the agent list) if the full-session scan grows
costly — noted in the route comment + the queue.

Outcome: fixed. class: false-limit truncation on an enumeration read. severity: medium bug / low live-impact
(dormant cron).
