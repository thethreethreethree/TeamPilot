# CHECK - Revenue Phase 2: the deal board

## Commands

```
npm run db:verify → 0371 ok (rolled back)
probe p0371.mjs (production, rolled back, booleans only):
  lead sets a list → current list has 2 stages
  rep sets a list → 42501 (refused)
  duplicate names (" demo " vs "Demo") → 23514; no open stage → 23514
  a removed view is gone from the current view; a view for someone else → 42501
npx vitest run src/app/api/coach/remote/deal-stages src/app/api/coach/remote/deal-views src/lib/coach/remote src/components/remote-sales → 94 files passed (exit 0)
tsc clean · theme / rls / invariant / reachability / writer / enum audits ✓
npm run check → gates the commit
```

## Findings

### F1 - a paged read ordered by a key the audit couldn't see was unique
class: paging over a view with a composite unique key.
sweep: prospects.ts deal_contacts_current (distinct on prospect_id, contact_id) → PAGING_UNIQUE_ALLOWLIST with that reason.
severity: low.
