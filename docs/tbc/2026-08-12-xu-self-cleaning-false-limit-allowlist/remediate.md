# REMEDIATE — F1 self-cleaning FALSE_LIMIT allowlist

## F1 — allowlist drift had no automatic self-report
Root cause: INVARIANT 21 `continue`s on any allowlisted file but never re-checked that the entry is STILL needed.
So a file fixed to remove its false limit (xr's care/agent/analytics) stays allowlisted → silently un-guarded,
findable only by manual re-audit (which is how xt caught it).

Remediation (CI-guard hygiene, no runtime change):
1. `hasLiveFalseLimit(sql)` helper + a loop over FALSE_LIMIT_ALLOWLIST that flags any entry whose file no longer
   contains a live `.limit(N>1000)` as STALE, with a "remove this entry" message.
2. A standing `st()` self-test — "every current FALSE_LIMIT_ALLOWLIST entry still has a live false bound" — so a
   stale entry trips the audit's own self-test (exit 3), the strongest signal, not just a finding.
3. Three matcher `st()` tests (live `.limit(5000)` → live; a reworded/fetchAllPaged'd file → stale; `.limit(300)`
   → no bound) locking `hasLiveFalseLimit` both directions.

Boundary (A26): scoped to the FALSE_LIMIT allowlist. The other ~15 allowlists suppress different patterns and are
not covered here — a generic self-cleaning pass is a separate, larger change, not silently implied by this one.

Detection: a probe entry for a no-false-limit file made the audit exit 3; reverted → green. Proven, not assumed.

Outcome: fixed. class: guard/allowlist drift (now self-reporting). severity: low (latent CI hole; recurrence
prevention for a mistake made this session).
