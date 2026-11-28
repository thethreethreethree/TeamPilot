# BUILD - E18: deep Ask

### Deep Ask
write-path: none — every batch is askCoach with save: false.
read-path: POST /api/coach/remote/ask {deep: true, sessionIds 11–50} → askCoachDeep: 10 calls at a time as the asker, then one combining answer keeping the renumbered citations; AskCalls offers it past 10 calls.
