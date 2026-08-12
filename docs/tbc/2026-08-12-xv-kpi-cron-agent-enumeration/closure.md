# CLOSURE — KPI compute-cron agent-enumeration truncation

## What shipped
The KPI compute-cron's agent-enumeration read is now paged (`fetchAllPaged`), so every distinct agent is seen
before the deterministic first-BATCH_AGENTS slice — closing the last surfaced truncation instance (the read
previously capped at 1000 rows and silently dropped late-sorting agents from the run). Removing the `.limit(5000)`
made its FALSE_LIMIT_ALLOWLIST entry stale, which the xu self-cleaning check flagged — so the entry was removed in
the same commit (the guard working in practice). The route test's mock was re-keyed to the paged read. Dormant
cron → zero live-user risk; correct the day it goes live.

## Verification (A38) — real gate output
`npm run check` — full gate, exit 0:

```
$ npm run check
typecheck ✓ · lint ✓ · theme:audit ✓ (0 leaks) · rls:audit ✓ (0 without RLS)
invariant:audit ✓ — Files scanned 773 · Violations 0 (FALSE_LIMIT self-cleaning check + self-tests pass)
tbc ✓ — docs · manifest · artifacts · residual · freshness — all ✓
test ✓ — Test Files 398 passed | 1 skipped (399); Tests 2744 passed | 15 skipped (2759)
EXITCODE=0
```

Route test: `npx vitest run src/app/api/coach/kpi/compute-cron` → 7 passed. The >1000-row paging boundary is
covered by paginate.test.ts (2500-row case).

## Residual (A36 — top OPENED)
```json
[
  { "id": "R1", "item": "BATCH_AGENTS=100 with no cross-run rotation: agents past the alphabetically-first 100 still never get a KPI snapshot.", "why_skipped": "That is a DESIGN decision (rotation / cursor / raise-the-batch), not a truncation bug, and it touches the founder-gated KPI measurement subsystem (the section-3.5 domain) — out of scope for a bug fix. Flagged in FOUNDER-ACTION-QUEUE.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-12T13:40:00Z", "outcome": "Opened + assessed: correctly left founder-gated. This build makes the first 100 correct + complete (which the truncation broke); processing >100 agents needs a rotation design the founder should choose." },
  { "id": "R2", "item": "The paged enumeration reads every session row company-wide just to derive distinct agents.", "why_skipped": "The durable fix is a SELECT DISTINCT agent_id RPC (fetches only the agent list) — a migration, founder-gated. The paged read is correct + consistent with the file's existing session paging, and the cron is dormant + maxDuration-bounded + 200k-backstopped.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-12T13:41:00Z", "outcome": "Opened + assessed: acceptable now; the RPC is the scale fix, noted in the route comment + queue. Correctness first, cost-optimisation when it goes live at scale." }
]
```

## Un-named reliance
- Relies on `[...keys()].sort()` (lexicographic on uuid agent_ids) matching the old `.order("agent_id")` intent
  closely enough that "the first BATCH_AGENTS agents" is stable + deterministic — confirmed by reading, not a live
  >100-agent run (no live DB in-sandbox).

## Status
Complete + tested (7/7 route tests; full gate exit 0, pasted above). Commit with the TBC-Build trailer + explicit
paths, push.
