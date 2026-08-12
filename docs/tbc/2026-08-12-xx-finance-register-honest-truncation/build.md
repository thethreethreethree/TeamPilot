# BUILD — finance register honest truncation

## Feature inventory
### The bank register now DISCLOSES when it's showing only the most recent 1,000 lines
- write-path: none (read-only register). N/A.
- read-path: `finance/bank/accounts/[id]/transactions` caps at PAGE_MAX=1000 (the honest max_rows, replacing the
  false `.limit(2000)`), and — only when the page is full — head-counts the true total (RLS-scoped, not
  row-capped) to return `{ transactions, total, truncated }`. The banking page renders an amber notice —
  "Showing the most recent 1,000 of N transactions — older lines aren't listed here yet." — only when truncated.
  Returned rows are byte-identical to before (both caps yield ≤1000 txn_date-desc rows); this only makes the
  hidden history VISIBLE. Confirmed by the invariant + RLS audits (Violations 0); the register is a thin RLS read with no
  existing unit test (A30 honesty).

## Files changed
- src/app/api/finance/bank/accounts/[id]/transactions/route.ts — honest 1000 cap + head-count + truncated flag.
- src/app/dashboard/finance/banking/page.tsx — track total/truncated, render the disclosure notice.
- scripts/invariant-audit.mjs — remove the now-resolved finance FALSE_LIMIT_ALLOWLIST entry (the xu self-cleaning
  check requires it); care.ts is now the SOLE remaining false-limit exception.

## Holistic (§1.5.1)
Disclosure only — the load-older / paginated register UI stays the founder-gated UX enhancement. No write, schema,
or amount/calc change; the head count is tenant-safe (same RLS user client). This is the last silent false-limit
made honest — the false-limit class is now fully closed except care.ts (the c5fbd454 KEEP/REVERT).
