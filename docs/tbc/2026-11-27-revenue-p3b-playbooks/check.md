# CHECK - Revenue Phase 3b: playbooks and the AI Deal Reviewer

## Commands

```
npm run db:verify → 0373 ok (rolled back)
probe p0373.mjs (production, rolled back, booleans/counts only), fixture deal on a real call:
  rep writes a note → ok; rep validates own deal → ok
  rep inserts an AI read directly → 42501 (refused: only the route's service role writes AI reads)
  another plain member validates → 42501 (can't see the deal)
  erasure → deal_notes_blanked 2, notes_left 0, ai_left 0, rows_kept 3
npx vitest run "src/app/api/coach/remote/prospects/[pid]/playbook" src/lib/coach/remote → 64 files passed (exit 0)
tsc clean · theme / rls / invariant / reachability / writer / enum audits ✓
npm run check → gates the commit
```

## Findings

### F1 - erasure set an AI read to null, which the row's own shape check refuses
class: an erasure blank that breaks a row invariant.
sweep: both erasure steps in 0373 (ai becomes {"answer": "[erased]", "cites": []}).
severity: high (erasure would have failed for any deal with an AI read); found by the probe.

### F2 - the review route's service-role insert and call reads flagged by the audits
class: service-role tenant pin and hidden calls.
sweep: the route reads every call and line through the caller's client; the service role only inserts rows whose company comes from the caller-read deal → allowlisted with those guards.
severity: low.
