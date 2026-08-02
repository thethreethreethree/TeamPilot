# CHECK — C.A.R.E AI-labor-mix read-only script

## Audit (H1)
- Ran the script against the LIVE DB (Session-pooler). It connected, the SQL executed against the real schema,
  and it returned a 3-tier partition summing to N: `fully_deflected + copilot_assisted + fully_manual` =
  `5 + 0 + 1` = `6` = N (resolved conversations). The partition is exhaustive and non-overlapping (deflected =
  no agent msgs; copilot = agent msgs all AI-drafted; manual = ≥1 unaided agent msg).
- The DIRECTIONAL-ONLY warning fired at N=6 (< 200), so the tool refuses to present the split as reliable — the
  §3.4 honesty guard works. I did NOT price anything off this baseline.
- No write occurred (SELECT-only; confirmed by inspection — no INSERT/UPDATE/DELETE in the script).
- Secondary confirmation: this proves the derivation I put in the founder's Phase 1-2 PDF is correct against the
  real schema (the query runs and partitions sensibly), not just asserted.

## Class sweep (A26)
No other code computes an AI-labor mix; the care analytics surfaces count agent/customer for other purposes but
don't split the co-pilot tier. No duplication.

## Findings
no findings — the script is read-only, verified live, and behavior matches the intended 3-tier model.

## Verification (A38)
```
$ node scripts/care-labor-mix.mjs

═══ C.A.R.E AI-labor mix (read-only) ═══

  fully_deflected  (~0 VA time)               5   83.3%
  copilot_assisted (reduced VA time)          0   0.0%
  fully_manual     (full VA time)             1   16.7%

  resolved conversations (N)                  6

  ⚠️  N=6 is too small — treat these percentages as DIRECTIONAL ONLY, not a basis for pricing.
     Re-run once C.A.R.E has real volume (a few hundred+ resolved tickets).
```
