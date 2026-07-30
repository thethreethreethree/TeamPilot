# REVISION MANIFEST — C.A.R.E Notifications (founder 2026-07-30)

Comprehensive settings, pillar 3. Dogfoods `npm run tbc:revision`.

```json
[
  { "id": "R0", "verb": "ADD", "item": "Migration 0204 — profiles.care_notify_customer_reply (default true).", "disposition": "done", "evidence": "0204_care_notify_pref.sql; APPLIED (DB at 0204); verify:live 14/14." },
  { "id": "R1", "verb": "ADD", "item": "/api/me/care-notifications GET/PATCH, self-scoped, A34-guarded.", "disposition": "done", "evidence": "route.ts mirrors /api/me/theme; isMissingColumnError → GET degraded / PATCH 409." },
  { "id": "R2", "verb": "CHANGE", "item": "careNotify reads the pref and skips the push on explicit false.", "disposition": "done", "evidence": "guarded read before sendPushToUsers; falls through to send on any error; stays fire-and-forget." },
  { "id": "R3", "verb": "ADD", "item": "CareNotificationsPanel toggle on the General tab.", "disposition": "done", "evidence": "optimistic switch, revert-on-error, degraded note; rendered in general/page.tsx." },
  { "id": "R4", "verb": "ADD", "item": "Send-path gating tests.", "disposition": "done", "evidence": "careNotify.test.ts +4 (opt-out→no push; missing column→push; null→push); 8/8." },
  { "id": "R5", "verb": "ADD", "item": "TBC artifacts + commit.", "disposition": "done", "evidence": "this build dir; tsc 0; full check green earlier this session." }
]
```

0204 APPLIED (not left pending — additive + safe). No item un-dispositioned.
