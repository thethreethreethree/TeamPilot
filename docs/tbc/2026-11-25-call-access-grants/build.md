# BUILD - An admin gives one teammate access to one call

Migration 0336_call_access_grants.sql (applied; DB at 0336). No env keys.

### An admin gives access
write-path: call page → "Who else can open this call" → teammate + reason → Give access → POST
/api/coach/remote/[id]/grants → call_access_grants + two manager_notifications (rep, grantee) + audit call.grant.
read-path: the panel lists who has access; the grantee's bell: "An admin gave you access to a call with Acme"; the rep's:
"An admin gave Tia access to your call with Acme".

### The teammate opens it
write-path: audit call.view_granted on each open.
read-path: /dashboard/remote-sales/shared/<call> → label, date, rep, the reason, the player (trims skipped), key points,
next steps, transcript.

### The admin takes it back
write-path: Take back → DELETE /api/coach/remote/[id]/grants → call_access_revocations + audit call.grant_revoke.
read-path: the shared page answers "You don't have access to this call."; the panel no longer lists them.
