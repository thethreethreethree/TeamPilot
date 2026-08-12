# CHECK — finance register honest truncation

## Verification run (A38)
Canonical command: `npm run check`.

## Findings
### F1 — the bank register silently hid transactions past ~1000 (no disclosure)
file+line: `finance/bank/accounts/[id]/transactions/route.ts` — `.limit(2000)` (PostgREST caps at 1000) with no
truncation signal; the register showed the newest ≤1000 lines and hid older ones silently.
class: honesty-thesis / false-limit — a DISPLAY truncation with no disclosure (an incomplete register that looks
complete, §3.4). The last remaining false-limit site.
severity: medium (live finance; user could believe their register is complete when it isn't).
sweep-command: `grep -rnE "\.limit\(\s*[0-9]{4,}\s*\)" src/app/api/finance` — after the fix, no >1000 limit in the
finance API; the FALSE_LIMIT invariant + its self-cleaning check confirm the allowlist now holds only care.ts.
remediation: honest 1000 cap + head-count total + a UI disclosure (see remediate.md).

## Tests
No unit test exists for this route or the banking page (A30 honesty) — a React page + a thin RLS read. The
head-count/disclosure logic is simple + typecheck-covered; the false-bound removal is confirmed by the FALSE_LIMIT
invariant (Violations 0, incl. the self-cleaning check). Behaviour is a data-preserving cap + additive notice.

## Full gate
```
PENDING — pasted in closure after the run
```
