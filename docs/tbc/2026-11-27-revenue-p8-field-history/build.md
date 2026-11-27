# BUILD - A deal's field history

### Field history
write-path: none — the history is remote_prospect_events, written by the deal route's "set" as before.
read-path: GET /api/coach/remote/prospects/[pid] returns history (newest 100) and actors (names, through the caller's client); fieldChanges words each change; the deal panel's Activity tab lists them under "Changes".
