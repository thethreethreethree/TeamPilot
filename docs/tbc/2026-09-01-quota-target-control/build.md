# BUILD — wire the missing quota-target control

### The manager-only editor (Team section)
- write-path: `kpi/page.tsx` — a `saveQuota(raw)` callback PATCHes `/api/coach/sales-session/quota` with
  `{ target: number|null }`, validating client-side against the server's exact bound (integer 1–100000, or
  blank→null to clear). Three render states in the Team block: unset → "Quota is off until you set a target" +
  **Set target**; set → value + **Edit**; editing → number input with Save/Cancel, Enter to save, Escape to
  cancel, inline error for 403/409/generic.
- read-path: a manager sees, right where the quota line was, either the active target or a one-click way to set
  it — the "building" Quota metric is now reachable from the product instead of a dead end.

### The refresh (close the continuity loop)
- write-path: extracted the `/team` fetch into `loadTeam(initial)`; `saveQuota` calls BOTH `loadMe()` and
  `loadTeam(false)` on success. `initial` gates the one-time default-to-company scope.
- read-path: after saving a target, the headline Quota AND every per-rep Quota column update in place — no stale
  "building" until a manual reload.

## Files
- `src/app/dashboard/sales-coach/kpi/page.tsx` — quota editor state + `saveQuota` + `loadTeam` extraction + the
  three-state control replacing the static quota line.

## Ripple (§6 item 5)
- No schema/route/compute change: reuses the existing manager-gated PATCH + `quotaAttainment` compute. Client
  validation mirrors the route's Zod schema term-for-term (drift risk noted; the route test is the durable guard).
- The control lives inside `{team && …}` (manager-only). Even on a gate mismatch the route's own 403 is handled
  as an inline message, never a crash.
