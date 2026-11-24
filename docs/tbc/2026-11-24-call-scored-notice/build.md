# BUILD - Tell the rep their call is scored

Migration 0332_notify_call_scored.sql (applied; DB at 0332). No env keys.

### A phone/video call's score lands
write-path: finalize / label-transcript → scoreSession → storePitchScore ok → notifyCallScored → manager_notifications
(type call_scored, recipient = the rep, payload {client_label, total}; one per call).
read-path: the rep's bell: "Your call with Betty is scored: 83 / 100 — see what went well and your next step" → the
call page (/dashboard/sales-coach/<session>, routed to Remote Sales).
