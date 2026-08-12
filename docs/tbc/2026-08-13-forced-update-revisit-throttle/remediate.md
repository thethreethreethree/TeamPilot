# REMEDIATE — F1 revisit auto-update blocked by the throttle

## F1 — the 30s throttle blocked the revisit auto-update
Root cause: `check()` throttles to once per 30s to avoid focus churn, and that early-return also fired for a
genuine reopen/revisit — so if a user returned within 30s of the last check, `scheduleReload()` never ran and the
secondary auto-update did not apply on that reopen.

Remediation:
1. `check(autoReload, bypassThrottle = false)` — the throttle is skipped when `bypassThrottle` is set.
2. The visibility handler passes it on a genuine revisit (`check(revisited, revisited)`), so a reopen always
   checks fresh and applies the update; ordinary focus churn still throttles.
3. All `scheduleReload` safety guards (recording hold, once-per-commit loop guard) are unchanged, so the bypass
   cannot cause a reload loop or interrupt a call.

Boundary (A26): revisit-only bypass; the pure `shouldForceReload` decision (7 tests) is unchanged.

Outcome: fixed. class: forced-update reliability gap. severity: medium. The founder's "auto-update on reopen/
revisit" now fires reliably, including a quick return.
