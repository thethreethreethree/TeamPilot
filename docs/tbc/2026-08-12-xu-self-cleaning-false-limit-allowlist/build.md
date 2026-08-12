# BUILD — self-cleaning FALSE_LIMIT allowlist

## Feature inventory
### A stale FALSE_LIMIT_ALLOWLIST entry now self-reports
- write-path: none (CI guard). N/A.
- read-path: after INVARIANT 21's main loop, the audit reads each FALSE_LIMIT_ALLOWLIST file's raw text and, if
  it no longer contains a live `.limit(N>1000)`, flags the entry as STALE (remove it). Backed by a standing
  `st()` self-test asserting every current entry is still live, so a stale entry fails the audit's own self-test
  (exit 3) as well as surfacing a finding. Asserted both directions by 4 `st()` tests + a live probe (closure).

## Files changed
- scripts/invariant-audit.mjs — add the `hasLiveFalseLimit` helper + the stale-entry self-check loop after
  INVARIANT 21, and 4 `st()` self-tests in the SELF-TEST block.

## Holistic (§1.5.1)
Scoped to the FALSE_LIMIT allowlist (where the xt drift occurred). No product/runtime behaviour change. The other
~15 allowlists are explicitly out of scope (each suppresses a different pattern; a generic version is a separate,
larger change). No new runtime code paths.
