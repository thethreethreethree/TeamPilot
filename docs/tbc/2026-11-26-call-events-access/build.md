# BUILD - A call's AI reads follow the call's access

Migration 0348_call_events_follow_call_access.sql (applied; DB at 0348). No env keys.

### A rep reads AI reads
write-path: none.
read-path: their own calls' summaries, reads and dispute events as before; a teammate's call's events return nothing.

### A manager reads AI reads
write-path: none.
read-path: calls in their reporting tree (or the whole company for an admin) as before; calls outside it return nothing.
