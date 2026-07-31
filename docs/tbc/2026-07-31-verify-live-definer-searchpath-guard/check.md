# CHECK — verify:live SECURITY DEFINER search_path guard

## Audit of the build

- **Only tightens:** independent new check; can only ADD a failure (an unpinned definer fn), never mask one.
- **Real class, not narrow:** search_path injection on elevated functions is a recognised privilege-escalation
  vector (Supabase's linter flags it) — this is its CI form, not a guard invented to fill the build pressure.
- **Complements INVARIANT 4:** that check is anon-reachability of definer tenant-param fns; this is the
  injection axis. Together they cover both definer-risk dimensions.
- **Read-only:** catalog query, no mutation.

## Findings

**No findings.** Passes on the healthy live DB (115 definer fns, 0 unpinned) and is detection-proven to flag
an unpinned function.

## Verification (canonical command + detection test)

`npm run verify:live` — **all 22 invariants hold**, including the new guard:

```
  ✓ PASS  no SECURITY DEFINER function lacks a pinned search_path (search_path-injection / privilege-escalation defense)  — all SECURITY DEFINER fns pin search_path
  ...
✅ ALL 22 invariants hold.
EXIT=0
```

Predicate detection test:

```
REAL: unpinned DEFINER fns = 0 (want 0 → guard passes)
detection: DEFINER fns that DO pin search_path = 115 (>0 confirms the predicate distinguishes pinned; a synthetic unpinned fn would be counted by REAL)
```

The predicate correctly counts unpinned (0 now) and distinguishes the 115 pinned — so a future definer fn
added without `set search_path` would be counted and FAIL the invariant.
