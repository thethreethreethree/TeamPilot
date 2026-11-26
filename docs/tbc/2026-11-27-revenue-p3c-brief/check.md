# CHECK - Revenue Phase 3c: the deal brief and suggested next steps

## Commands

```
npm run db:verify → 0374 ok (rolled back)
probe p0374.mjs (production, rolled back, counts only):
  rep: sees 1 brief; direct insert → 42501
  another plain member: sees 0; direct insert → 42501
  erasure: deal_briefs 1 deleted, 0 left
npx vitest run "src/app/api/coach/remote/prospects" src/lib/coach/remote/revenue → 10 files passed (exit 0)
tsc clean · theme / rls / invariant / reachability / writer audits ✓
npm run check → gates the commit
```

## Findings

### F1 - a stale hidden-calls allowlist entry after moving the call reads into one helper
class: an allowlist entry outliving the code it excused.
sweep: the playbook route (removed; the audit's stale-entry check caught it).
severity: low.
