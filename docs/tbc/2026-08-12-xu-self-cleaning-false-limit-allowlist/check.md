# CHECK — self-cleaning FALSE_LIMIT allowlist

## Verification run (A38)
Canonical command: `npm run check`.

## Findings
### F1 — the FALSE_LIMIT allowlist had no self-cleaning, so a fixed entry silently rots into a blind spot
file+line: `scripts/invariant-audit.mjs` — INVARIANT 21 + its FALSE_LIMIT_ALLOWLIST.
class: guard/allowlist drift with no self-report — the class that produced the xt stale entry (a fixed file left
allowlisted, silently un-guarded). Without a self-check, the next such drift is again only findable by manual
re-audit.
severity: low (a latent CI-guard hole; not a live bug) — but a recurring maintenance risk, evidenced by my own
xr→xt slip this session.
sweep-command: `grep -n "route.ts\|care.ts" scripts/invariant-audit.mjs` over the FALSE_LIMIT_ALLOWLIST block,
cross-checked against `grep -rnE "\.limit\(\s*[0-9]{4,}\s*\)" src` — after the fix, the audit itself performs this
cross-check on every run (each allowlist entry must still match a live limit), so the sweep is now automated.
remediation: a self-check + standing self-test (see remediate.md).

## Detection test (A30 — the new guard bites)
```
# temporarily allowlisted a no-false-limit file (list route, .limit(300)):
$ npm run invariant:audit
⚠️ INVARIANT-AUDIT SELF-TEST FAILED — a guard can no longer detect its own violation
EXIT=3
# probe reverted → Violations: 0, EXIT=0.
```
(The `st()` self-test "every current FALSE_LIMIT_ALLOWLIST entry still has a live false bound" fires first and
exits 3; the findings loop independently flags the stale entry. Both detect the drift.)

## Full gate
```
PENDING — pasted in closure after the run
```
