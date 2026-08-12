# REMEDIATE — F1 finance register silent truncation

## F1 — the register hid transactions past ~1000 with no disclosure
Root cause: a fixed `.limit(2000)` (PostgREST caps at 1000) returned only the newest ≤1000 lines; the UI showed
them as if the register were complete. A busy account's older history was invisible with no signal — the
honesty-thesis failure (§3.4) on a live finance surface.

Remediation (honest default = disclose; full pagination stays founder-gated):
1. Cap explicitly at PAGE_MAX=1000 (the honest max_rows, matching assetReadout's FILE_SCAN_CAP), removing the
   false 2000 bound. Returned rows unchanged.
2. When the page is full, head-count the true total (`count: exact, head: true`, RLS-scoped, not row-capped;
   skipped in the common under-cap case). Return `{ transactions, total, truncated }`.
3. The register UI renders an amber disclosure — "Showing the most recent 1,000 of N transactions — older lines
   aren't listed here yet." — only when truncated.
4. Remove the now-resolved finance FALSE_LIMIT_ALLOWLIST entry (the xu self-cleaning check flags it once the >1000
   bound is gone). care.ts is now the SOLE remaining false-limit exception.

Boundary (A26): this DISCLOSES the cap; it does not add load-older / paginated retrieval (a UX decision — offered
to the founder as "paginate the finance register"). No amount/calc/schema change; the head count is tenant-safe.

Outcome: fixed. class: honesty-thesis display truncation (now disclosed). severity: medium (live finance). This is
the last silent false-limit — the class is now fully closed except the founder-gated care.ts.
