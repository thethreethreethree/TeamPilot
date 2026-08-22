# CHECK — Prep-up Phase 5: wire-in

## Gate — the canonical command (A38)

```
$ npm run check
 Test Files  558 passed | 1 skipped (559)
      Tests  3667 passed | 15 skipped (3682)
EXIT: 0
```

All gates exit 0. Route + panel + page change; no schema change; prep-less meetings unchanged.

## What the tests prove
- Create route: a `prepId` binds the prep to the new session (`markMeetingPrepStarted` with the sessionId); no
  `prepId` → prep-less meeting (never linked). Existing create/list tests still pass.
- The panel/page reads `?prepId` server-side and sends it on create (wiring); the Prep-up UI + agenda-brain
  tests from Phases 2-3 continue to pass.

## Scope note (§1.5.3)
Global sidebar nav + module-gating are DEFERRED to go-live (they'd advertise a feature that can't persist until
migrations 0237 + 0238 are applied). The Prep-up → coach loop is reachable/usable by URL now (as the MVP is).

## Findings
**No findings.** Reuses the Phase-3 session_id agenda lookup; the link is best-effort so a meeting never fails to
start; prep-less is unchanged.
