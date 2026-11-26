# BUILD - Acting on the review of shared streams and brief templates

No migration. No env keys.

### Someone opens a call's Briefs after a trim
write-path: none (until they run it again: POST → a new custom_briefs row for the new version).
read-path: GET /[id]/custom-brief → loadLines through the caller's client → current version → only that version's run → none → "Answer from this call" is offered again.

### A model reply is cut off
write-path: runBriefTemplate → parseAnswers null → nothing stored → 502 "Couldn't run that brief — try again."
read-path: the next GET finds no run; the person can run it again.

### A manager reads coverage / saves into a path
write-path: library add → siblings compared without case → existing folder reused.
read-path: coverage → each tracker's own `of` and `enough` → too-few trackers say so instead of a share.
