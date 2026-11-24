# BUILD - Turn off FYI bell notices

Migration 0334_notification_mutes.sql (applied; DB at 0334). No env keys.

### A person turns an FYI notice off (or on)
write-path: Settings → Bell notices → switch → PUT /api/me/notification-mutes {type, muted} → notification_mutes row
(user and company from the session).
read-path: the bell (GET /api/coach/gamification/notifications) leaves muted types out of the list and the unread
badge; the switch shows off. Notices that ask for action always arrive.
