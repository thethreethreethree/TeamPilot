# BUILD - An event about a call carries the call's company

Migration 0349_call_events_company_from_call.sql (applied; DB at 0349). No env keys.

### Any call event is written
write-path: record_event / service-role insert into events → trigger sets company_id from the call (or score).
read-path: the event is readable by the call's company under 0348; a writer from another company is refused.
