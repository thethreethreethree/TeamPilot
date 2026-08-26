# CLOSURE — View-session authz-review fixes + drift guards

## What shipped
Follow-ups from the adversarial security review of the view-session fix (which came back CLEAN on tenant isolation /
authz): (F1) a failed team-activity aggregate no longer shows "No sessions" for every rep — it stays blank/unknown, so
a transient error can't tell the manager "nobody is using it"; (F2) the rep session list is labeled "Most recent 100"
when capped; a rate-limit was added to team-activity for consistency. Plus two source-drift guards that lock the fix
class: rep-activity must not re-add the audio filter and must stay tenant-scoped + manager-gated; team-activity must
stay manager-gated + company-scoped.

## Verification (A38)
`npm run check` → EXIT 0 (see check.md). 8 drift tests pass; typecheck clean. The security review confirmed no tenant
leak / no authz bypass — unchanged by these fixes.

## The un-named reliance
- **The drift guards are source-string checks** (the codebase's established pattern, e.g. salesCoachShellNav). They
  lock the code SHAPE (no audio filter, tenant scopes, authz calls present), not the live DB behavior — which the
  view-session build verified against real data (Knute 0 → 44). Both together = shape + behavior covered.

## Residual (A36 — explicit)
```json
[
  {
    "id": "R1",
    "item": "Two review notes NOT acted on: the LOW/informational cap-vs-count ambiguity is now labeled (F2 done); no other open items from this review.",
    "why_skipped": "The review found no security/correctness bug beyond F1/F2 + the rate-limit nit, all addressed. The authz was clean.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-27T07:06:00+08:00",
    "outcome": "OPENED + bounded: the review's actionable items are all handled; nothing outstanding."
  }
]
```
