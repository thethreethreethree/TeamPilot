# Where these files go

| From | To |
|---|---|
| `elostate-revenue/src/lib/revenue/*.ts` | `src/lib/coach/remote/revenue/` (drop the `.ts` in imports) |
| `elostate-revenue/tests/revenue.test.ts` | `src/lib/coach/remote/revenue/__tests__/` (vitest) |
| migrations | `supabase/migrations/0370+`, written per phase against the live schema |

Next: Phase 1 under TBC (`docs/07-BUILD-ORDER.md`).
