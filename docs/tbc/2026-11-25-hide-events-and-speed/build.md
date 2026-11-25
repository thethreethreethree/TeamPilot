# BUILD - A hidden call's AI reads are hidden too, and the hide checks run once per query

Migration 0341_hide_by_phrase_events.sql (applied; DB at 0341). No env keys.

### Someone in the company reads a hidden call's AI reads
write-path: none (read rules only).
read-path: events with subject sales_session:<hidden call> return no rows to anyone but its rep and company admins; other
events, and calls not hidden, are unchanged.

### A manager opens a call's transcript
write-path: none.
read-path: the same rows as before, through set-based hide rules (one evaluation per query).
