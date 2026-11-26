# CHECK - Revenue Phase 1: accounts and contacts

## Commands

```
npm run db:verify → 0370 ok (rolled back)
probe p0370.mjs (production, rolled back, counts only):
  backfill 0 prospects with an organization → 0 accounts (nothing to convert yet)
  key: "  ACME, Inc. " = "acme inc"; "Acme" ≠ "Acme Inc"; "Café Ünïon" → "cafe union"
  find-or-create: same key → same account
  a deal on another company's account → refused
  rep of the deal: sees 1 account, 1 event; direct insert refused
  another plain member of the company: sees 0, 0; direct insert refused
  erasure: contact on the erased call renamed (contacts_renamed 1)
  cross-company call-contact link → refused
tsc clean · theme / rls / invariant / reachability / writer / enum audits ✓
npm run check → gates the commit
```

## Findings

### F1 - one trigger function for four tables read new.kind on tables without it
class: a shared plpgsql trigger body over different row types.
sweep: 0370's triggers (split into three functions).
severity: high (every contact link would have failed); found by the probe, not by db:verify.

### F2 - a contact count read past the 1000-row cap
class: a capped read used for an aggregate.
sweep: accounts.ts (paged with fetchAllPaged; other reads ≤1000 and ordered by a unique key).
severity: medium.

### F3 - rules.ts had no caller yet
class: a module built ahead of its phase (A31).
sweep: src/lib/coach/remote/revenue; it stays in the plan scaffold until Phases 3–4 wire it.
severity: low.
