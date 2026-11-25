# BUILD - Legal erasure reaches a call's events wherever they were filed

Migration 0350_erasure_events_by_subject.sql (applied; DB at 0350). No env keys.

### An admin erases a customer
write-path: Remote Sales → Protection → erasure → rss_erase_sessions → deletes the matched calls' events by subject.
read-path: no AI read of those calls remains under any company; other companies' calls untouched.
