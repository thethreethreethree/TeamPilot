# BUILD - Engage E1: flows, enrolments, today's steps

Migration 0377 (engage_flows, engage_enrolments, engage_activities; contact email and phone; erasure). No env keys;
nothing is sent from the app.

### A manager makes a flow
write-path: Engage → Flows → New flow → POST /api/coach/remote/engage/flows → engage_flows (CHECK rss_valid_flow_steps; company flows by policy).
read-path: GET /engage/flows → the list and the deal panel's flow picker.

### A rep adds a contact to a flow
write-path: deal panel → a contact → Email, phone, flow → POST /contacts/:cid {email|phone} → contact_events; POST /engage/enrolments {enrol} → engage_enrolments (opt-out check first; trigger: deal's rep, live flow).
read-path: Engage → Today (listEngage → replayEnrolment).

### A rep works a step
write-path: Today → Mark sent / Log the call (outcome) / Done / Skip / They replied / Pause / Remove → POST {step} → engage_activities.
read-path: the replay moves the enrolment on, finishes it or removes it.
