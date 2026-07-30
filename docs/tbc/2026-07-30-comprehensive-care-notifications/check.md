# CHECK — C.A.R.E Notifications audit

Outside-view stance.

## Within-module (four layers)

- **1 structure:** mirrors the /api/me/theme per-user-pref pattern (column on profiles + guarded route);
  no new pattern. One column, one route, one send-path read, one panel.
- **2 effectivity:** the toggle actually changes behavior — careNotify reads it and skips the push on false.
  Proven by the 8/8 test (opt-out → no push; on/null → push).
- **3 composition:** lives on the General tab beside Learning/Experience; consistent switch UI; optimistic
  with revert-on-error.
- **4 surface:** clear label + the honest caveats (unassigned never push; delivery also needs browser/device
  notifications; migration-pending note when degraded).

## Cross-module

- **Send-path safety (customer-facing):** careNotify remains fire-and-forget + swallows errors; the added
  pref read is inside the same try, so a pref-read failure cannot break customer-message handling. On ANY
  pref-read error it sends (safe default: don't silently suppress notifications).
- **A34 seam:** route guarded with isMissingColumnError (409/degraded); send path degrades to notify. Tested.
- **Tenant/self scope:** the route is self-only (profiles RLS id = auth.uid()); careNotify uses the admin
  client to read the ASSIGNED agent's own pref (correct — it's deciding whether to push THAT agent).

## Class sweep (A26)

- class: a stored preference that no code reads (dead toggle). sweep: `grep -rn "care_notify_customer_reply"
  src` → the migration (write), the route (read/write), careNotify (the READ that gates the send), the panel,
  and the test. The read-at-send exists → not dead.

## Findings

None. Additive column (default = current behavior); send-path change is guarded + non-throwing; test-locked.

## Inspected / not-inspected

- **Inspected:** migration, route (GET/PATCH + guards), careNotify wiring, panel, General render, the 8/8
  test, tsc, verify:live (14/14 post-apply).
- **NOT inspected (→ residual):** live browser click-through (toggle off → confirm no push arrives) needs a
  device with push configured (VAPID) + a real customer reply; the remaining founder-input pillars (Data &
  Privacy retention, Sales-Coach grading) are separate.
