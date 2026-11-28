# BUILD - E12–E14 review fixes

### Agents after a link
write-path: agent_runs records a failed claim on its agent (ok false) and the loop goes on; the deal route has maxDuration 90.
read-path: loadDealCalls(…, { exclude }) drops the owner's hidden calls before the newest are picked (brief and playbook actions).

### Battlecard focus
write-path: none.
read-path: askCoach({ focus }) keeps the lines around each mention of the competitor when calls are too long to send whole (keepLines); the call header says so.

### Recommended contacts reads
write-path: none.
read-path: newest call links first; call contacts read in chunks of 150 calls, filtered to candidates in code (no contact list in the URL).

### API pages and note history
write-path: none.
read-path: /api/v1/scores and /api/v1/calls carry `more`; the playbook note history is read to the end (reviewer and the Playbook tab).
