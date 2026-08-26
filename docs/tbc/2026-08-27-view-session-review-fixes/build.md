# BUILD — View-session authz-review fixes + drift guards

### F1 — honest failure state (§3.4)
- write-path: `StandardSessionsManagerView.tsx` — `activityLoaded` is set ONLY on a successful team-activity load; the
  fetch rejects on !ok. The roster annotation renders blank while unknown/failed, "N sessions · last active X" or "No
  sessions in the last 30 days" only once loaded.
- read-path: a transient aggregate error no longer tells the manager "nobody is using it".

### F2 — cap-truthful list
- write-path: `rep-activity/route.ts` returns `atCap`/`cap`; the RepActivity header reads "Most recent 100 sessions"
  when capped, else "Sessions".
- read-path: no false implication of completeness for a very active rep.

### rate-limit consistency
- write-path: `team-activity/route.ts` — added `rateLimit` (30/min), matching rep-activity + /recordings.
- read-path: a burst of roster loads past 30/min gets a 429 from the shared limiter instead of unbounded DB reads.

### drift guards (A30)
- write-path: `rep-activity/__tests__/noAudioFilter.drift.test.ts` (5) + `team-activity/__tests__/tenantScope.drift.test.ts` (3).
- read-path: re-adding the audio filter, dropping a tenant scope, or dropping the manager gate fails a test.

## Files
- `src/components/sales-coach/StandardSessionsManagerView.tsx` — F1 + F2 UI.
- `src/app/api/coach/sales-session/rep-activity/route.ts` — atCap/cap.
- `src/app/api/coach/sales-session/team-activity/route.ts` — rateLimit.
- `src/app/api/coach/sales-session/rep-activity/__tests__/noAudioFilter.drift.test.ts` — drift guard.
- `src/app/api/coach/sales-session/team-activity/__tests__/tenantScope.drift.test.ts` — drift guard.

## Ripple (§6 item 5)
No authz change — the review confirmed the tenant isolation is sound. The fixes only make failures honest and the cap
truthful, plus a rate-limit for consistency. The drift guards are source-greps (no runtime coupling).

## Honest limit
The drift guards are source-string checks (the codebase's established pattern); they lock the shape, not the live DB
behavior — that's covered by the real-data verification in the view-session build (Knute 0 → 44).
