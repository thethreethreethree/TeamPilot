# CLOSURE — Gamification Phase 1 (data model)

## What shipped
The two genuinely-new tables the gamification feature needs, given Phase 0 found scoring already exists:
`agent_point_ledger` (append-only, raising immutability, no double-bank, company-scoped owner+manager RLS,
service-role writes) and `manager_notifications` (two types, recipient-dedupe, recipient-only RLS), plus the
single-source constants/types (`rubric.ts`). Points REUSE the existing after-pitch scores (§2.2, founder decision);
per-session detail stays rep-private (A18) while the board (Phase 5) will show rank+totals via an aggregate view.
Applied live (30/30 invariants); append-only + no-double-bank behaviorally proven in a rolled-back transaction.

## Verification (A38)
`npm run db:apply` 30/30; `npm run typecheck` clean; `scripts/verify-gamification-ledger.mjs` 5/5 (rolled back);
rubric config test 5/5. All pasted in check.md.

## The un-named reliance
- Relies on `auth_company_id()` (0001) for tenant scoping — the same function every other table uses.
- Relies on the after-pitch scores being the score source (Phase 2 maps them); this Phase writes no points itself.
- Relies on the append-only trigger applying to service-role too (it does — verified), so the ledger is truly permanent.

## Residual (A36 — explicit)
```json
[
  {
    "id": "GAM-R1",
    "item": "Manager notifications fan out to ALL company admins (no per-agent manager FK exists — FINDINGS item 8). For a large company that is many recipients per strong session. Acceptable for v1; a real reporting roster would narrow it.",
    "why_skipped": "The plan's Phase 4 accepts fan-out; a roster is a separate build the founder hasn't asked for.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-03T11:30:00+08:00",
    "outcome": "OPEN — revisit if strong-session alerts become noisy at scale."
  },
  {
    "id": "GAM-R2",
    "item": "The outcome-enum mismatch (FINDINGS risk 10: 0205's won/lost was a no-op; live values are 'sold/...') is NOT fixed here. Gamification keys deal_closed on the real 'sold' value; the pre-existing KPI code that assumes 'won' is a separate latent issue.",
    "why_skipped": "Out of Phase-1 scope; fixing the enum touches existing KPI data + code. Gamification sidesteps it by keying on the live value.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-03T11:30:00+08:00",
    "outcome": "OPEN — address the 0205 enum mismatch as a separate KPI fix."
  }
]
```
