# BUILD - Link a call to its prospect, from any call view

No migration. No env keys.

### Add a call to a prospect
write-path: a finished phone/video call (full view or Macro Mode) → CallPipelineLink → "Which prospect was this call
with?" → an existing open prospect → POST /api/coach/remote/prospects/[pid] { action: "link", sessionId }; or "New
prospect: <call label>" → POST /api/coach/remote/prospects { name, sessionId } → remote_prospect_calls (0304: the call's
rep only).
read-path: GET /api/coach/remote/[id]/pipeline-link → "In the pipeline: <name>" linking to the prospect; Macro Mode
reloads (onLinked) so its next-call date sees the prospect.
