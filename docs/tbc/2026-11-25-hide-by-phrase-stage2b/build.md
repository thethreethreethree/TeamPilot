# BUILD - Service-role lists stop naming hidden calls (stage 2b)

Migration 0340_hide_admin_same_company.sql (applied; DB at 0340). No env keys.

### A manager opens their coaching screens
write-path: none (reads only).
read-path: GET /api/coach/remote/coaching-inbox, /coaching-metrics, /api/coach/sales-session/list,
/api/coach/sales-session/pitch-score/disputes, /api/coach/gamification/calibration and /api/coach/remote/ask?sessionId
leave out a call a company phrase hid from them (and a coach chat covering one). A failed check is a 500 / degraded /
unavailable, never a list that might include it.

### A manager tries to act on a hidden call
write-path: POST pitch-recordings/comment, pitch-recordings/share (ask), pitch-score/override and calibration score →
404 before anything is written.
read-path: the call page shows "This call is hidden by a company rule"; the [id]/hidden route answers from the SQL rule.

### Vendor staff monitor a company
write-path: none.
read-path: listCompanySessions / getMonitoredSession leave out hidden calls; a failed check fails safe (nothing).
