# REMEDIATE — F1 false-limit allowlist drift

## F1 — stale FALSE_LIMIT_ALLOWLIST entry created a silent guard blind spot
Root cause: build xr replaced `care/agent/analytics`'s `.limit(5000)` with `fetchAllPaged` but left the route's
FALSE_LIMIT_ALLOWLIST entry in place. Since INVARIANT 21 `continue`s on any allowlisted file, the stale entry
meant a future re-introduced `.limit(N>1000)` on that route would be silently skipped — a latent regression hole
on the exact file xr had fixed (§1.5.1 ripple I should have traced in xr).

Remediation (two parts, because the guard scans raw text incl. comments):
1. Reword the route's fix-history comment from the literal `.limit(5000)` to "a fixed 5000-row cap", so the
   restored guard doesn't false-positive on the comment.
2. Remove the `care/agent/analytics/route.ts` entry from FALSE_LIMIT_ALLOWLIST (inline note records why),
   restoring the guard on that route.

The 5 still-real entries (finance register, admin coach-readout ×3, brain learning-summary, care.ts, KPI cron)
are retained — each still documents a live, founder-gated false bound tracked as "fix the false limits".

Detection: re-added a `.limit(5000)` probe → invariant:audit Violations: 1 on that file; reverted → 0. The guard
bites again.

Outcome: fixed. class: guard/allowlist drift (an exception that outlived what it documented). severity: low-medium
(latent CI-guard hole, no live bug).
