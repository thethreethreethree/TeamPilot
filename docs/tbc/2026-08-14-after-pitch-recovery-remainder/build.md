# BUILD — After-Pitch recovery remainder (⑥ stale-reload + ⑧ single-voice loop)

### client heals a stale blank on the canonical reload (finding ⑥)
read-path: `src/app/dashboard/sales-coach/[id]/after-pitch/page.tsx` `autoRecover()` — a `canonical` response
(transcript already two-sided) now triggers `generate()`.
write-path: `generate()` POSTs `/after-pitch`, rebuilding + storing the read from the now-two-sided transcript.
This heals the OLD blank customer-missing summary a lost client-refresh left behind. Fires at most once (the
regenerated read is two-sided → no capture gap on the next visit), and adds no server-side generation → no
double-charge.

### route persists a single-voice decline + reports it on reload (finding ⑧)
read-path: `src/app/api/coach/sales-session/[id]/auto-recover/route.ts` — the `already-attempted` branch now
reads a `coach.auto_recover_declined` event for the session.
write-path: on a `single-cluster` decline the route inserts that event (coarse: reason only); on a reload (marker
set + a prior decline) it returns `still-one-sided` instead of `already-attempted`, so the client renders the
honest terminal, never a re-transcribe card. NOT written for `ambiguous` (retryable).

## Test coverage
`src/app/api/coach/sales-session/[id]/auto-recover/__tests__/route.test.ts` (admin mock extended for the events
insert + decline read): a single-cluster decline persists `coach.auto_recover_declined`; a reload (marker set +
prior decline) returns `still-one-sided` with NO STT re-charge; an ambiguous decline does NOT persist. Finding ⑥
is a client page effect (repo convention: 0 `*.test.tsx`) — a browser repro is the honest check (residual).

## Notes
- The client `canonical`→regenerate reuses the existing owner-only `/after-pitch` POST; no new write path.
- The decline event is company-visible coarse metadata (reason only), consistent with the other coach events; no
  A18 score leak.
